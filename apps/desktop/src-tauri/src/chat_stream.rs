use std::{collections::HashMap, sync::{Mutex, OnceLock}, time::Duration};
use tauri::ipc::Channel;
use serde_json::Value;
use tauri::async_runtime::JoinHandle;
static STREAMS: OnceLock<Mutex<HashMap<String, JoinHandle<()>>>> = OnceLock::new();
fn streams() -> &'static Mutex<HashMap<String, JoinHandle<()>>> { STREAMS.get_or_init(|| Mutex::new(HashMap::new())) }
fn valid_id(value: &str) -> bool { !value.is_empty() && value.len() <= 100 && value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') }

#[tauri::command]
pub fn runtime_stream_start(subscription_id: String, conversation_id: String, channel: Channel<Value>) -> Result<(), String> {
    if !valid_id(&subscription_id) || !valid_id(&conversation_id) { return Err("INVALID_REQUEST".into()); }
    let connection = super::connection()?;
    let mut entries = streams().lock().map_err(|_| "UNAVAILABLE")?;
    if entries.len() >= 8 || entries.contains_key(&subscription_id) { return Err("STREAM_LIMIT".into()); }
    let key = subscription_id.clone();
    let task = tauri::async_runtime::spawn(async move {
        let result = consume(connection, conversation_id, &channel).await;
        let _ = channel.send(serde_json::json!({"type":"disconnected", "error":result.err().unwrap_or("UNAVAILABLE")}));
        if let Ok(mut entries) = streams().lock() { entries.remove(&key); }
    });
    entries.insert(subscription_id, task); Ok(())
}
#[tauri::command]
pub fn runtime_stream_stop(subscription_id: String) -> Result<(), String> {
    if let Some(task) = streams().lock().map_err(|_| "UNAVAILABLE")?.remove(&subscription_id) { task.abort(); }
    Ok(())
}
async fn consume(connection: super::Connection, conversation_id: String, channel: &Channel<Value>) -> Result<(), &'static str> {
    let client = reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(5)).read_timeout(Duration::from_secs(40)).build().map_err(|_| "UNAVAILABLE")?;
    let mut response = client.get(format!("http://127.0.0.1:{}/v1/events/stream?conversationId={}", connection.port, conversation_id)).bearer_auth(connection.token).send().await.map_err(|_| "UNAVAILABLE")?;
    if !response.status().is_success() { return Err("UNAVAILABLE"); }
    let mut pending = Vec::new();
    while let Some(bytes) = response.chunk().await.map_err(|_| "UNAVAILABLE")? {
        pending.extend_from_slice(&bytes);
        while let Some(end) = pending.iter().position(|b| *b == b'\n') {
            if end > 8_388_608 { return Err("STREAM_TOO_LARGE"); }
            let event: Value = serde_json::from_slice(&pending[..end]).map_err(|_| "INVALID_STREAM")?;
            pending.drain(..=end);
            channel.send(event).map_err(|_| "STREAM_CLOSED")?;
        }
        if pending.len() > 8_388_608 { return Err("STREAM_TOO_LARGE"); }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    #[test] fn restrict_identifiers() { assert!(super::valid_id("abc-123")); for s in ["", "../secret", "a?url=https://evil", "a/b", "a\n"] { assert!(!super::valid_id(s)); } }
}

#[cfg(test)]
mod transport_tests {
    use super::*;
    use std::{io::{Read, Write}, net::TcpListener, sync::{Arc, atomic::{AtomicBool, Ordering}}, thread};
    #[test]
    fn real_http_chunks_reach_ipc_before_eof_and_abort_closes_connection() {
        super::super::initialize_tls();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap(); let port = listener.local_addr().unwrap().port();
        let delivered = Arc::new(AtomicBool::new(false)); let observed = delivered.clone();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap(); socket.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
            let mut request = [0u8;4096]; let count = socket.read(&mut request).unwrap();
            let request_text = String::from_utf8_lossy(&request[..count]); assert!(request_text.contains("authorization: Bearer fixture-token"));
            socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nConnection: close\r\n\r\n{\"type\":\"message\",\"text\":\"").unwrap();
            thread::sleep(Duration::from_millis(30)); socket.write_all("片段\"}\n".as_bytes()).unwrap();
            for _ in 0..200 { if observed.load(Ordering::SeqCst) { break; } thread::sleep(Duration::from_millis(5)); }
            assert!(observed.load(Ordering::SeqCst), "IPC must receive data before server completes");
            assert_eq!(socket.read(&mut request).unwrap(), 0, "aborting the task must release HTTP stream");
        });
        let (tx, rx) = std::sync::mpsc::channel();
        let channel = Channel::new(move |message| { if let tauri::ipc::InvokeResponseBody::Json(value) = message { assert!(value.contains("片段")); delivered.store(true, Ordering::SeqCst); tx.send(()).unwrap(); } Ok(()) });
        let task = tauri::async_runtime::spawn(async move { consume(super::super::Connection { version:1, port, token:"fixture-token".into(), instance_id:"fixture".into() }, "session-1".into(), &channel).await });
        rx.recv_timeout(Duration::from_secs(5)).unwrap(); task.abort();
        let _ = tauri::async_runtime::block_on(task); server.join().unwrap();
    }
}

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod connection_security;
use serde::Deserialize;
use std::{path::PathBuf, time::Duration};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Connection { version: u8, port: u16, token: String, instance_id: String }

fn data_dir() -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("BIGFATFISH_DATA_DIR") {
        if path.trim().is_empty() { return Err("INVALID_CONNECTION".into()); }
        return Ok(PathBuf::from(path));
    }
    #[cfg(target_os = "windows")]
    { return std::env::var("LOCALAPPDATA").map(|p| PathBuf::from(p).join("BigFatFish")).map_err(|_| "INVALID_CONNECTION".into()); }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").map_err(|_| "INVALID_CONNECTION")?;
        #[cfg(target_os = "macos")]
        { Ok(PathBuf::from(home).join("Library/Application Support/BigFatFish")) }
        #[cfg(not(target_os = "macos"))]
        { Ok(std::env::var("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from(home).join(".local/share")).join("bigfatfish")) }
    }
}
fn connection() -> Result<Connection, String> {
    let root = data_dir()?;
    for path in [&root, &root.join("runtime")] {
        let meta = std::fs::symlink_metadata(path).map_err(|_| "NOT_RUNNING")?;
        if meta.file_type().is_symlink() || !meta.is_dir() { return Err("INSECURE_CONNECTION".into()); }
    }
    let file = root.join("runtime/connection.json");
    let meta = std::fs::symlink_metadata(&file).map_err(|_| "NOT_RUNNING")?;
    if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > 4096 { return Err("INVALID_CONNECTION".into()); }
    #[cfg(unix)] {
        use std::os::unix::fs::MetadataExt;
        if meta.mode() & 0o077 != 0 || meta.uid() != unsafe { libc::geteuid() } { return Err("INSECURE_CONNECTION".into()); }
    }
    #[cfg(target_os = "windows")]
    connection_security::verify(&root, &file)?;
    let content = std::fs::read_to_string(file).map_err(|_| "INVALID_CONNECTION")?;
    let result: Connection = serde_json::from_str(&content).map_err(|_| "INVALID_CONNECTION")?;
    if result.version != 1 || result.port == 0 || result.token.len() != 64 || !result.token.chars().all(|c| c.is_ascii_hexdigit()) { return Err("INVALID_CONNECTION".into()); }
    Ok(result)
}
#[tauri::command]
async fn runtime_status() -> Result<serde_json::Value, String> {
    let connection = connection()?;
    let client = reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(3)).build().map_err(|_| "UNAVAILABLE")?;
    let response = client.get(format!("http://127.0.0.1:{}/v1/status", connection.port)).bearer_auth(connection.token).send().await.map_err(|_| "UNAVAILABLE")?;
    if response.status().as_u16() == 401 { return Err("UNAUTHORIZED".into()); }
    if !response.status().is_success() { return Err("UNAVAILABLE".into()); }
    let status: serde_json::Value = response.json().await.map_err(|_| "UNAVAILABLE")?;
    if status["instanceId"].as_str() != Some(&connection.instance_id) || status["state"] != "running" { return Err("INVALID_CONNECTION".into()); }
    Ok(status)
}
#[tauri::command]
async fn runtime_request(route: String, method: String, body: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    let allowed = route.starts_with("/v1/") && route.len() < 256 && route.chars().all(|c| c.is_ascii_alphanumeric() || "/-_".contains(c));
    if !allowed || !["GET", "POST", "PUT", "DELETE"].contains(&method.as_str()) { return Err("INVALID_REQUEST".into()); }
    let connection = connection()?;
    let client = reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(if route.starts_with("/v1/bilibili") { 190 } else if route == "/v1/douyin" || route == "/v1/douyin/close" || route == "/v1/activities/pause" { 30 } else { 5 })).build().map_err(|_| "UNAVAILABLE")?;
    let method = reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "INVALID_REQUEST")?;
    let mut request = client.request(method.clone(), format!("http://127.0.0.1:{}{}", connection.port, route)).bearer_auth(connection.token);
    if method == reqwest::Method::POST || method == reqwest::Method::PUT { request = request.json(&body.unwrap_or(serde_json::json!({}))); }
    let response = request.send().await.map_err(|_| "UNAVAILABLE")?;
    let success = response.status().is_success();
    let value: serde_json::Value = response.json().await.map_err(|_| "UNAVAILABLE")?;
    if !success { return Err(value["error"].as_str().unwrap_or("UNAVAILABLE").to_string()); }
    Ok(value)
}
fn main() {
    tauri::Builder::default().invoke_handler(tauri::generate_handler![runtime_status, runtime_request]).run(tauri::generate_context!()).expect("desktop initialization failed");
}

#[cfg(target_os = "windows")]
pub fn verify(root: &std::path::Path, file: &std::path::Path) -> Result<(), String> {
    use std::{io::Write, os::windows::process::CommandExt, process::{Command, Stdio}};
    let script = include_str!("../../../runtime/src/windows-acl.ps1");
    // Constant script on the command line, data only on stdin. No path interpolation.
    let executable = std::env::var_os("SystemRoot").map(std::path::PathBuf::from)
        .ok_or("INSECURE_CONNECTION")?
        .join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let input = serde_json::to_vec(&serde_json::json!({"operation": "verify", "entries": [
        {"path": root, "directory": true},
        {"path": root.join("runtime"), "directory": true},
        {"path": file, "directory": false}
    ]})).map_err(|_| "INSECURE_CONNECTION")?;
    let mut child = Command::new(executable)
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script])
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null())
        .creation_flags(0x08000000).spawn().map_err(|_| "INSECURE_CONNECTION")?;
    let write_result = child.stdin.take().ok_or("INSECURE_CONNECTION")?.write_all(&input);
    if write_result.is_err() { let _ = child.kill(); let _ = child.wait(); return Err("INSECURE_CONNECTION".into()); }
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if std::time::Instant::now() < deadline => std::thread::sleep(std::time::Duration::from_millis(20)),
            _ => { let _ = child.kill(); let _ = child.wait(); return Err("INSECURE_CONNECTION".into()); }
        }
    }
    let output = child.wait_with_output().map_err(|_| "INSECURE_CONNECTION")?;
    if !output.status.success() || output.stdout != b"OK" { return Err("INSECURE_CONNECTION".into()); }
    Ok(())
}

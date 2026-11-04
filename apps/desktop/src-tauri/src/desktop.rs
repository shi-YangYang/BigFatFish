use serde::{Deserialize, Serialize};
use std::{
    io::Write,
    process::{Command, Stdio},
    sync::Mutex,
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_autostart::ManagerExt;
pub static ALLOW_EXIT: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
pub static SELECTED: Mutex<Option<std::path::PathBuf>> = Mutex::new(None);
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub data_dir: String,
    pub background: bool,
    pub complete: bool,
}
fn settings_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|_| "SETTINGS_UNAVAILABLE")?
        .join("desktop.json"))
}
pub fn settings(app: &tauri::AppHandle) -> Result<Settings, String> {
    let file = settings_file(app)?;
    if file.exists() {
        let mut value: Settings = serde_json::from_slice(&std::fs::read(file).map_err(|_| "SETTINGS_UNAVAILABLE")?)
            .map_err(|_| "SETTINGS_INVALID")?;
        if super::development::managed() { value.data_dir = super::development::data_dir()?.to_string_lossy().into(); }
        return Ok(value);
    }
    Ok(Settings {
        data_dir: super::data_dir()?.to_string_lossy().into(),
        background: true,
        complete: false,
    })
}
pub fn cli(
    app: &tauri::AppHandle,
    args: Vec<String>,
    input: serde_json::Value,
) -> Result<serde_json::Value, String> {
    super::development::ensure_cli_allowed(&args)?;
    let mut command = if super::development::managed() {
        super::development::cli_command()?
    } else {
        let root = app.path().resource_dir().map_err(|_| "INSTALLATION_INCOMPLETE")?.join("runtime");
        let mut command = Command::new(root.join(if cfg!(windows) { "bin/node.exe" } else { "bin/node" }));
        command.arg(root.join("dist/cli/src/main.js"));
        command
    };
    command
        .args(args)
        .arg("--data-dir")
        .arg(super::data_dir()?)
        .arg("--json")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|_| "INSTALLATION_INCOMPLETE")?;
    child
        .stdin
        .take()
        .ok_or("CLI_FAILED")?
        .write_all(input.to_string().as_bytes())
        .map_err(|_| "CLI_FAILED")?;
    let output = child.wait_with_output().map_err(|_| "CLI_FAILED")?;
    let value: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|_| "CLI_FAILED")?;
    if !output.status.success() {
        return Err(value["error"].as_str().unwrap_or("CLI_FAILED").into());
    }
    Ok(value)
}
#[tauri::command]
pub async fn desktop_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let s = settings(&app)?;
    Ok(
        serde_json::json!({"version":app.package_info().version.to_string(),"dataDir":s.data_dir,"background":s.background,"complete":s.complete,"autostart":app.autolaunch().is_enabled().map_err(|_|"AUTOSTART_FAILED")?}),
    )
}
#[tauri::command]
pub async fn desktop_configure(
    app: tauri::AppHandle,
    data_dir: String,
    background: bool,
    autostart: bool,
    complete: bool,
) -> Result<serde_json::Value, String> {
    if data_dir.trim().is_empty() || !std::path::Path::new(&data_dir).is_absolute() {
        return Err("INVALID_DATA_DIR".into());
    }
    let selected = resolved_path(std::path::Path::new(&data_dir))?;
    let resources = app
        .path()
        .resource_dir()
        .map_err(|_| "INSTALLATION_INCOMPLETE")?;
    let installation = if cfg!(target_os = "macos") {
        resources
            .parent()
            .and_then(|p| p.parent())
            .ok_or("INSTALLATION_INCOMPLETE")?
            .to_path_buf()
    } else {
        resources
    };
    let installation = resolved_path(&installation)?;
    if selected.starts_with(&installation) || installation.starts_with(&selected) {
        return Err("DATA_INSIDE_INSTALLATION".into());
    }

    let old = settings(&app)?;
    if super::development::managed() && old.data_dir != data_dir { return Err("DEV_DATA_DIR_FIXED".into()); }
    if old.complete && old.data_dir != data_dir {
        return Err("USE_BACKUP_TO_MIGRATE".into());
    }
    *SELECTED.lock().map_err(|_| "SETTINGS_UNAVAILABLE")? = Some(data_dir.clone().into());
    if !super::development::managed() {
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        cli(&handle, vec!["start".into()], serde_json::json!({}))
    })
    .await
    .map_err(|_| "CLI_FAILED")??;
    }
    if autostart {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    }
    .map_err(|_| "AUTOSTART_FAILED")?;
    let file = settings_file(&app)?;
    std::fs::create_dir_all(file.parent().unwrap()).map_err(|_| "SETTINGS_UNAVAILABLE")?;
    std::fs::write(
        file,
        serde_json::to_vec(&Settings {
            data_dir,
            background,
            complete,
        })
        .unwrap(),
    )
    .map_err(|_| "SETTINGS_UNAVAILABLE")?;
    desktop_settings(app).await
}
#[tauri::command]
pub async fn desktop_maintenance(
    app: tauri::AppHandle,
    action: String,
    input: serde_json::Value,
) -> Result<serde_json::Value, String> {
    if !["export", "inspect", "restore"].contains(&action.as_str()) {
        return Err("INVALID_REQUEST".into());
    }
    let args = vec!["backup".into(), action];
    super::development::ensure_cli_allowed(&args)?;
    tauri::async_runtime::spawn_blocking(move || cli(&app, args, input))
        .await
        .map_err(|_| "CLI_FAILED")?
}
pub fn quit(app: &tauri::AppHandle) {
    if super::development::managed() {
        ALLOW_EXIT.store(true, std::sync::atomic::Ordering::SeqCst);
        app.exit(0);
    } else {
        let app = app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            if cli(&app, vec!["stop".into()], serde_json::json!({})).is_ok() {
                ALLOW_EXIT.store(true, std::sync::atomic::Ordering::SeqCst);
                app.exit(0);
            }
        });
    }
}

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let s = settings(app.handle())?;
    *SELECTED.lock().unwrap() = Some(s.data_dir.into());
    let app_quit = MenuItem::with_id(app, "app-quit", "退出并停止服务", true, Some("CmdOrCtrl+Q"))?;
    let application = Submenu::with_items(app, "BigFatFish", true, &[&app_quit])?;
    let edit = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    app.set_menu(Menu::with_items(app, &[&application, &edit])?)?;
    app.on_menu_event(|app, event| {
        if event.id.as_ref() == "app-quit" {
            quit(app);
        }
    });
    let open = MenuItem::with_id(app, "open", "打开 BigFatFish", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "暂停自动活动", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出并停止服务", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &pause, &quit_item])?;
    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "pause" => {
                tauri::async_runtime::spawn(async {
                    let _ = super::runtime_request(
                        "/v1/activities/pause".into(),
                        "POST".into(),
                        Some(serde_json::json!({"paused":true})),
                    )
                    .await;
                });
            }
            "quit" => {
                quit(app);
            }
            _ => {}
        })
        .build(app)?;
    if s.complete && !super::development::managed() {
        let app = app.handle().clone();
        tauri::async_runtime::spawn_blocking(move || {
            if cli(
                &app,
                vec!["update".into(), "desktop-finish".into()],
                serde_json::json!({"version":app.package_info().version.to_string()}),
            )
            .is_ok()
            {
                let _ = cli(&app, vec!["start".into()], serde_json::json!({}));
            }
        });
    }
    if std::env::args().any(|a| a == "--background") {
        if let Some(w) = app.get_webview_window("main") {
            w.hide()?;
        }
    }
    Ok(())
}

fn resolved_path(path: &std::path::Path) -> Result<std::path::PathBuf, String> {
    let mut result = std::path::PathBuf::new();
    for part in path.components() {
        match part {
            std::path::Component::ParentDir => {
                result.pop();
            }
            std::path::Component::CurDir => {}
            _ => result.push(part.as_os_str()),
        };
        if result.exists() {
            result = std::fs::canonicalize(&result).map_err(|_| "INVALID_DATA_DIR")?;
        }
    }
    Ok(result)
}

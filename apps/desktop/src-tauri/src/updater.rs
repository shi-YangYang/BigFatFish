use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trust {
    endpoint: String,
    public_key: String,
}
fn file(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|_| "UPDATE_CONFIG_FAILED")?
        .join("updater.json"))
}
#[tauri::command]
pub async fn desktop_update_trust(
    app: AppHandle,
    endpoint: String,
    public_key: String,
) -> Result<(), String> {
    let url = reqwest::Url::parse(&endpoint).map_err(|_| "UPDATE_HTTPS_REQUIRED")?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || public_key.trim().is_empty()
    {
        return Err("UPDATE_TRUST_INVALID".into());
    }
    let path = file(&app)?;
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|_| "UPDATE_CONFIG_FAILED")?;
    std::fs::write(
        path,
        serde_json::to_vec(&Trust {
            endpoint,
            public_key,
        })
        .unwrap(),
    )
    .map_err(|_| "UPDATE_CONFIG_FAILED".into())
}
#[tauri::command]
pub async fn desktop_update(app: AppHandle, install: bool) -> Result<serde_json::Value, String> {
    let path = file(&app)?;
    if !path.exists() {
        return Ok(serde_json::json!({"state":"unconfigured"}));
    }
    let trust: Trust =
        serde_json::from_slice(&std::fs::read(path).map_err(|_| "UPDATE_CONFIG_FAILED")?)
            .map_err(|_| "UPDATE_CONFIG_FAILED")?;
    let endpoint = reqwest::Url::parse(&trust.endpoint).map_err(|_| "UPDATE_TRUST_INVALID")?;
    if endpoint.scheme() != "https" {
        return Err("UPDATE_HTTPS_REQUIRED".into());
    }
    let updater = app
        .updater_builder()
        .pubkey(trust.public_key)
        .endpoints(vec![endpoint])
        .map_err(|_| "UPDATE_TRUST_INVALID")?
        .timeout(std::time::Duration::from_secs(120))
        .configure_client(|builder| {
            builder
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
        })
        .build()
        .map_err(|_| "UPDATE_TRUST_INVALID")?;
    let update = updater.check().await.map_err(|_| "UPDATE_CHECK_FAILED")?;
    let Some(update) = update else {
        return Ok(serde_json::json!({"state":"no-release"}));
    };
    let Some(bytes) = prepare_online_update(&update, install).await? else {
        return Ok(serde_json::json!({"state":"available","version":update.version}));
    };
    let handle = app.clone();
    let install_root = installation_root(&app)?;
    let version = update.version.clone();
    let snapshot = tauri::async_runtime::spawn_blocking(move || {
        super::desktop::cli(
            &handle,
            vec!["update".into(), "desktop-snapshot".into()],
            serde_json::json!({"installRoot":install_root,"version":version}),
        )
    })
    .await
    .map_err(|_| "UPDATE_BACKUP_FAILED")??;
    if let Err(error) = preflight(
        &app,
        &bytes,
        update.raw_json["schema"].as_u64().unwrap_or(0),
    )
    .await
    {
        let _ = super::desktop::cli(
            &app,
            vec!["update".into(), "desktop-unlock".into()],
            serde_json::json!({}),
        );
        return Err(error);
    }
    if update.install(bytes).is_err() {
        let _ = super::desktop::cli(
            &app,
            vec!["update".into(), "desktop-unlock".into()],
            serde_json::json!({}),
        );
        return Err("UPDATE_INSTALL_FAILED_DATA_PRESERVED".into());
    }
    Ok(serde_json::json!({"state":"installed","restartRequired":true,"snapshot":snapshot}))
}

async fn prepare_online_update(update: &Update, install: bool) -> Result<Option<Vec<u8>>, String> {
    // Updater 2.14.1 only warns for insecure package URLs. Enforce transport on
    // the resolved platform URL before reporting availability or requesting bytes.
    if update.download_url.scheme() != "https" {
        return Err("UPDATE_HTTPS_REQUIRED".into());
    }
    if update.raw_json["schema"].as_u64().unwrap_or(0) < 6
        || update.raw_json["minSchema"].as_u64().unwrap_or(6) > 6
    {
        return Err("UPDATE_SCHEMA_UNSUPPORTED".into());
    }
    if !install {
        return Ok(None);
    }
    // The official updater verifies its Minisign signature before returning bytes.
    update
        .download(|_, _| {}, || {})
        .await
        .map(Some)
        .map_err(|_| "UPDATE_VERIFY_FAILED".into())
}

#[tauri::command]
pub async fn desktop_update_file(
    app: AppHandle,
    manifest: String,
    archive: String,
    install: bool,
) -> Result<serde_json::Value, String> {
    let trust: Trust =
        serde_json::from_slice(&std::fs::read(file(&app)?).map_err(|_| "UPDATE_TRUST_INVALID")?)
            .map_err(|_| "UPDATE_TRUST_INVALID")?;
    let metadata = std::fs::metadata(&manifest).map_err(|_| "UPDATE_FILE_INVALID")?;
    if !metadata.is_file() || metadata.len() > 262144 {
        return Err("UPDATE_FILE_INVALID".into());
    }
    let raw: serde_json::Value =
        serde_json::from_slice(&std::fs::read(manifest).map_err(|_| "UPDATE_FILE_INVALID")?)
            .map_err(|_| "UPDATE_FILE_INVALID")?;
    if raw["schema"].as_u64().unwrap_or(0) < 6 || raw["minSchema"].as_u64().unwrap_or(6) > 6 {
        return Err("UPDATE_SCHEMA_UNSUPPORTED".into());
    }
    let endpoint = reqwest::Url::parse(&trust.endpoint).map_err(|_| "UPDATE_TRUST_INVALID")?;
    if endpoint.scheme() != "https" {
        return Err("UPDATE_HTTPS_REQUIRED".into());
    }
    let updater = app
        .updater_builder()
        .pubkey(trust.public_key)
        .endpoints(vec![endpoint])
        .map_err(|_| "UPDATE_TRUST_INVALID")?
        .build()
        .map_err(|_| "UPDATE_TRUST_INVALID")?;
    let update = updater
        .restore_update(raw)
        .map_err(|_| "UPDATE_FILE_INVALID")?
        .ok_or("UPDATE_NOT_NEWER")?;
    let metadata = std::fs::metadata(&archive).map_err(|_| "UPDATE_FILE_INVALID")?;
    if !metadata.is_file() || metadata.len() > 1024 * 1024 * 1024 {
        return Err("UPDATE_FILE_INVALID".into());
    }
    let bytes = std::fs::read(&archive).map_err(|_| "UPDATE_FILE_INVALID")?;
    update.verify(&bytes).map_err(|_| "UPDATE_VERIFY_FAILED")?;
    if !install {
        return Ok(serde_json::json!({"state":"verified","version":update.version}));
    }
    let handle = app.clone();
    let install_root = installation_root(&app)?;
    let version = update.version.clone();
    let snapshot = tauri::async_runtime::spawn_blocking(move || {
        super::desktop::cli(
            &handle,
            vec!["update".into(), "desktop-snapshot".into()],
            serde_json::json!({"installRoot":install_root,"version":version}),
        )
    })
    .await
    .map_err(|_| "UPDATE_BACKUP_FAILED")??;
    if let Err(error) = preflight(
        &app,
        &bytes,
        update.raw_json["schema"].as_u64().unwrap_or(0),
    )
    .await
    {
        let _ = super::desktop::cli(
            &app,
            vec!["update".into(), "desktop-unlock".into()],
            serde_json::json!({}),
        );
        return Err(error);
    }
    if update.install(bytes).is_err() {
        let _ = super::desktop::cli(
            &app,
            vec!["update".into(), "desktop-unlock".into()],
            serde_json::json!({}),
        );
        return Err("UPDATE_INSTALL_FAILED_DATA_PRESERVED".into());
    }
    Ok(serde_json::json!({"state":"installed","restartRequired":true,"snapshot":snapshot}))
}
#[tauri::command]
pub fn desktop_restart(app: AppHandle) {
    super::desktop::ALLOW_EXIT.store(true, std::sync::atomic::Ordering::SeqCst);
    app.restart();
}

async fn preflight(app: &AppHandle, bytes: &[u8], schema: u64) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let path = super::data_dir()?.join("runtime/desktop-verified.tar.gz");
        std::fs::write(&path, bytes).map_err(|_| "UPDATE_FILE_INVALID")?;
        let hash = format!("{:x}", Sha256::digest(bytes));
        let handle = app.clone();
        let file = path.to_string_lossy().to_string();
        let result = tauri::async_runtime::spawn_blocking(move || {
            super::desktop::cli(
                &handle,
                vec!["update".into(), "desktop-preflight".into()],
                serde_json::json!({"file":file,"sha256":hash,"schema":schema}),
            )
        })
        .await
        .map_err(|_| "UPDATE_HEALTH_FAILED")?;
        let _ = std::fs::remove_file(path);
        result?;
    }
    Ok(())
}

fn installation_root(app: &AppHandle) -> Result<String, String> {
    let resources = app
        .path()
        .resource_dir()
        .map_err(|_| "UPDATE_INSTALLATION_INVALID")?;
    #[cfg(target_os = "macos")]
    {
        return Ok(resources
            .parent()
            .and_then(|p| p.parent())
            .ok_or("UPDATE_INSTALLATION_INVALID")?
            .to_string_lossy()
            .to_string());
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(resources.to_string_lossy().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::time::Duration;

    fn update(url: &str) -> Update {
        let mut context = tauri::test::mock_context(tauri::test::noop_assets());
        context.config_mut().plugins.0.insert(
            "updater".into(),
            serde_json::json!({"pubkey": "", "requireSignedVersion": true}),
        );
        let app = tauri::test::mock_builder()
            .plugin(tauri_plugin_updater::Builder::new().build())
            .build(context)
            .unwrap();
        let updater = app
            .updater_builder()
            .target("test-target")
            .executable_path(std::env::temp_dir().join("bigfatfish-test/app"))
            .endpoints(vec!["https://example.invalid/update".parse().unwrap()])
            .unwrap()
            .configure_client(|builder| {
                builder
                    .no_proxy()
                    .redirect(reqwest::redirect::Policy::none())
            })
            .build()
            .unwrap();
        let mut update = updater
            .restore_update(serde_json::json!({
                "version": "999.0.0", "schema": 6, "minSchema": 6,
                "platforms": { "test-target": { "url": url, "signature": "unused" } }
            }))
            .unwrap()
            .unwrap();
        update.timeout = Some(Duration::from_millis(100));
        update
    }

    #[test]
    fn online_http_package_is_rejected_before_availability_or_any_request() {
        let _ = rustls::crypto::ring::default_provider().install_default();
        let server = TcpListener::bind("127.0.0.1:0").unwrap();
        server.set_nonblocking(true).unwrap();
        let update = update(&format!("http://{}/package", server.local_addr().unwrap()));
        for install in [false, true] {
            let result = tauri::async_runtime::block_on(prepare_online_update(&update, install));
            assert_eq!(result.unwrap_err(), "UPDATE_HTTPS_REQUIRED");
        }
        let mut requests = 0;
        while server.accept().is_ok() {
            requests += 1;
        }
        assert_eq!(requests, 0, "HTTP package must never receive a request");
        println!("HTTP package requests: {requests}; available and install rejected");
    }

    #[test]
    fn online_https_package_retains_availability_and_schema_checks() {
        let mut update = update("https://example.invalid/package");
        assert!(
            tauri::async_runtime::block_on(prepare_online_update(&update, false))
                .unwrap()
                .is_none()
        );
        update.raw_json["minSchema"] = serde_json::json!(7);
        assert_eq!(
            tauri::async_runtime::block_on(prepare_online_update(&update, false)).unwrap_err(),
            "UPDATE_SCHEMA_UNSUPPORTED"
        );
    }
}

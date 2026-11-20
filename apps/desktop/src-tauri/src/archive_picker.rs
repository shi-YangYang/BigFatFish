use std::path::PathBuf;

use rfd::AsyncFileDialog;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BackupFileMode {
    Export,
    Restore,
}

// Only pick a local path. Inspect, export and restore remain separate operations.
#[tauri::command]
pub async fn desktop_pick_backup_file(window: tauri::WebviewWindow, mode: BackupFileMode) -> Option<PathBuf> {
    let dialog = AsyncFileDialog::new()
        .set_parent(&window)
        .add_filter("BigFatFish 备份", &["bff"]);
    let selected = match mode {
        BackupFileMode::Export => dialog.set_title("保存备份").set_file_name("bigfatfish.bff").save_file().await,
        BackupFileMode::Restore => dialog.set_title("选择备份文件").pick_file().await,
    };
    selected.map(|file| file.path().to_path_buf())
}

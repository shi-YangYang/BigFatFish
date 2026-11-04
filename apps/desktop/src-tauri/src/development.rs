// Opt-in for the source development supervisor only; release builds ignore it.
pub fn managed() -> bool {
    cfg!(debug_assertions) && std::env::var("BIGFATFISH_DEV_MANAGED").as_deref() == Ok("1")
}

pub enum Operation<'a> {
    Cli {
        command: &'a str,
        action: Option<&'a str>,
    },
    Update {
        install: bool,
    },
    Restart,
}

pub fn ensure_allowed(operation: Operation<'_>) -> Result<(), String> {
    check_operation(managed(), operation)
}

pub fn ensure_cli_allowed(args: &[String]) -> Result<(), String> {
    ensure_allowed(Operation::Cli {
        command: args.first().map(String::as_str).unwrap_or(""),
        action: args.get(1).map(String::as_str),
    })
}

fn check_operation(managed: bool, operation: Operation<'_>) -> Result<(), String> {
    if !managed {
        return Ok(());
    }
    // A maintenance stop would make the supervisor terminate the Tauri tree,
    // including its CLI child, potentially while that child is writing data.
    let error = match operation {
        Operation::Cli {
            command: "start" | "stop" | "restart",
            ..
        } => "DEV_RUNTIME_MANAGED",
        Operation::Cli {
            command: "backup",
            action: Some("export" | "restore"),
        } => "DEV_MAINTENANCE_UNAVAILABLE",
        Operation::Cli {
            command: "update",
            action:
                Some(
                    "desktop-snapshot" | "rollback" | "desktop-rollback" | "install"
                    | "install-file" | "desktop-preflight" | "desktop-finish" | "desktop-unlock",
                ),
        }
        | Operation::Update { install: true } => "DEV_UPDATE_UNAVAILABLE",
        Operation::Restart => "DEV_RESTART_MANAGED",
        _ => return Ok(()),
    };
    Err(error.into())
}

pub fn data_dir() -> Result<std::path::PathBuf, String> {
    absolute_env("BIGFATFISH_DATA_DIR")
}
fn absolute_env(key: &str) -> Result<std::path::PathBuf, String> {
    let value = std::env::var_os(key).ok_or("DEV_CONFIGURATION_INVALID")?;
    let path = std::path::PathBuf::from(value);
    if !path.is_absolute() {
        return Err("DEV_CONFIGURATION_INVALID".into());
    }
    Ok(path)
}
pub fn cli_command() -> Result<std::process::Command, String> {
    let mut command = std::process::Command::new(absolute_env("BIGFATFISH_DEV_NODE")?);
    command.arg(absolute_env("BIGFATFISH_DEV_CLI")?);
    Ok(command)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn managed_dev_rejects_lifecycle_and_maintenance_commands() {
        for (command, actions, error) in [
            ("start", vec![None], "DEV_RUNTIME_MANAGED"),
            ("stop", vec![None], "DEV_RUNTIME_MANAGED"),
            ("restart", vec![None], "DEV_RUNTIME_MANAGED"),
            (
                "backup",
                vec![Some("export"), Some("restore")],
                "DEV_MAINTENANCE_UNAVAILABLE",
            ),
            (
                "update",
                vec![
                    Some("desktop-snapshot"),
                    Some("rollback"),
                    Some("desktop-rollback"),
                    Some("install"),
                    Some("install-file"),
                    Some("desktop-preflight"),
                    Some("desktop-finish"),
                    Some("desktop-unlock"),
                ],
                "DEV_UPDATE_UNAVAILABLE",
            ),
        ] {
            for action in actions {
                assert_eq!(
                    check_operation(true, Operation::Cli { command, action }).unwrap_err(),
                    error
                );
                assert!(check_operation(false, Operation::Cli { command, action }).is_ok());
            }
        }
    }

    #[test]
    fn managed_dev_preserves_inspection_and_update_checks() {
        for managed in [false, true] {
            for (command, action) in [
                ("backup", Some("inspect")),
                ("update", None),
                ("update", Some("check")),
                ("update", Some("trust")),
                ("status", None),
            ] {
                assert!(check_operation(managed, Operation::Cli { command, action }).is_ok());
            }
            assert!(check_operation(managed, Operation::Update { install: false }).is_ok());
        }
    }

    #[test]
    fn managed_dev_rejects_native_install_and_restart_only() {
        assert_eq!(
            check_operation(true, Operation::Update { install: true }).unwrap_err(),
            "DEV_UPDATE_UNAVAILABLE"
        );
        assert_eq!(
            check_operation(true, Operation::Restart).unwrap_err(),
            "DEV_RESTART_MANAGED"
        );
        assert!(check_operation(false, Operation::Update { install: true }).is_ok());
        assert!(check_operation(false, Operation::Restart).is_ok());
    }
}

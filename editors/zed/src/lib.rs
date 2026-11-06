use zed_extension_api::{
    self as zed,
    settings::{CommandSettings, LspSettings},
};

const SERVER_PACKAGE: &str = "@lensmap/language-server";
const SERVER_VERSION: &str = include_str!("../server-version");

fn command_with_override(
    binary: Option<CommandSettings>,
    managed: impl FnOnce() -> zed::Result<zed::Command>,
) -> zed::Result<zed::Command> {
    match binary {
        Some(binary) => Ok(zed::Command::new(binary.path.ok_or(
            "Set lsp.lensmap.binary.path, or remove the binary override to use the managed server.",
        )?)
        .args(binary.arguments.unwrap_or_default())
        .envs(binary.env.unwrap_or_default())),
        None => managed(),
    }
}

fn ensure_server(
    installed: Option<&str>,
    install: impl FnOnce(&str, &str) -> zed::Result<()>,
) -> zed::Result<()> {
    let version = SERVER_VERSION.trim();
    if installed != Some(version) {
        install(SERVER_PACKAGE, version).map_err(|error| format!(
            "Could not install {SERVER_PACKAGE}@{version}: {error}. Check npm availability or configure lsp.lensmap.binary for a local runtime."
        ))?;
    }
    Ok(())
}

fn check_node_version(version: &str) -> zed::Result<()> {
    let parts = version
        .trim()
        .trim_start_matches('v')
        .split('.')
        .map(str::parse::<u32>)
        .collect::<Result<Vec<_>, _>>();
    if let Ok(parts) = parts {
        if let [major, minor, patch] = parts.as_slice() {
            if (*major, *minor, *patch) >= (24, 16, 0) {
                return Ok(());
            }
        }
    }
    Err("Lensmap requires Node 24.16 or newer. Update the Node runtime selected by Zed, or configure lsp.lensmap.binary for a supported local runtime.".into())
}

struct Lensmap;

impl zed::Extension for Lensmap {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        command_with_override(
            LspSettings::for_worktree("lensmap", worktree)?.binary,
            || {
                let node = zed::node_binary_path()?;
                let output = zed::process::Command::new(&node)
                    .arg("--version")
                    .output()?;
                if output.status != Some(0) {
                    return Err(
                        "Could not check Zed's Node runtime. Lensmap requires Node 24.16 or newer."
                            .into(),
                    );
                }
                check_node_version(&String::from_utf8_lossy(&output.stdout))?;
                let installed = zed::npm_package_installed_version(SERVER_PACKAGE)?;
                ensure_server(installed.as_deref(), |package, version| {
                    zed::set_language_server_installation_status(
                        language_server_id,
                        &zed::LanguageServerInstallationStatus::Downloading,
                    );
                    zed::npm_install_package(package, version)
                })?;
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::None,
                );
                let server = std::env::current_dir()
                    .map_err(|error| error.to_string())?
                    .join("node_modules/@lensmap/language-server/dist/main.js");
                Ok(zed::Command::new(node)
                    .arg(server.to_string_lossy())
                    .arg("--stdio"))
            },
        )
    }
}

zed::register_extension!(Lensmap);

#[cfg(test)]
mod tests {
    use super::*;
    use zed::settings::CommandSettings;

    #[test]
    fn explicit_override_preserves_command_and_never_installs() {
        let command = command_with_override(
            Some(CommandSettings {
                path: Some("/custom/node".into()),
                arguments: Some(vec!["/custom/server.js".into(), "--stdio".into()]),
                env: Some([("CUSTOM".into(), "value".into())].into()),
            }),
            || panic!("An explicit override must not install a managed runtime."),
        )
        .unwrap();
        assert_eq!(command.command, "/custom/node");
        assert_eq!(command.args, ["/custom/server.js", "--stdio"]);
        assert_eq!(command.env, [("CUSTOM".into(), "value".into())]);
        assert!(command_with_override(
            Some(CommandSettings {
                path: None,
                arguments: None,
                env: None
            }),
            || panic!("A malformed override must not fall back to npm."),
        )
        .is_err());
        assert_eq!(
            command_with_override(None, || Ok(zed::Command::new("managed-node")))
                .unwrap()
                .command,
            "managed-node"
        );
    }

    #[test]
    fn only_an_exact_cached_runtime_skips_installation_and_errors_propagate() {
        for (installed, expected_install) in [
            (None, true),
            (Some("older-version"), true),
            (Some(SERVER_VERSION.trim()), false),
        ] {
            let mut installed_now = false;
            ensure_server(installed, |package, version| {
                assert_eq!(package, SERVER_PACKAGE);
                assert_eq!(version, SERVER_VERSION.trim());
                installed_now = true;
                Ok(())
            })
            .unwrap();
            assert_eq!(installed_now, expected_install);
        }
        assert!(
            ensure_server(None, |_, _| Err("Registry unavailable".into()))
                .unwrap_err()
                .contains("Registry unavailable")
        );
    }

    #[test]
    fn node_minimum_matches_the_runtime_requirement() {
        for supported in ["v24.16.0\n", "v24.22.1", "v25.0.0"] {
            assert!(check_node_version(supported).is_ok());
        }
        for unsupported in ["v24.15.0", "v22.19.0", "not a version", ""] {
            assert!(check_node_version(unsupported)
                .unwrap_err()
                .contains("24.16"));
        }
    }
}

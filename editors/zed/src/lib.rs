use zed_extension_api::{self as zed, settings::LspSettings};

struct Lensmap;

impl zed::Extension for Lensmap {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        let binary = LspSettings::for_worktree("lensmap", worktree)?
            .binary
            .ok_or(
                "Configure lsp.lensmap.binary using the local server's --configure-zed output.",
            )?;
        let command = binary.path.ok_or("Set lsp.lensmap.binary.path to Node.")?;
        Ok(zed::Command::new(command)
            .args(binary.arguments.unwrap_or_default())
            .envs(binary.env.unwrap_or_default()))
    }
}

zed::register_extension!(Lensmap);

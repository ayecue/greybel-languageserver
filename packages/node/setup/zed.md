# Zed Setup

A ready-made extension is available at [miniscript-lsp-zed-extension](https://github.com/ayecue/miniscript-lsp-zed-extension). It targets `miniscript-languageserver` but can be adapted for `greybel-languageserver` by changing the package name and server path.

The rest of this guide explains how to create a Zed extension that integrates `greybel-languageserver` from scratch.

## Project Structure

```
greybel-lsp-zed-extension/
  Cargo.toml
  extension.toml
  src/
    greyscript.rs
  languages/
    greyscript/
      config.toml
      highlights.scm
```

## 1. Extension Manifest

Create `extension.toml` to declare the extension, its language server, and grammar:

```toml
id = "greyscript"
name = "GreyScript"
version = "0.0.1"
schema_version = 1
authors = ["your-name"]
description = "GreyScript LSP extension for Zed"
repository = "https://github.com/your-name/greybel-lsp-zed-extension"

[language_servers.greybel-languageserver]
name = "GreyScript LSP"
language = "GreyScript"

[grammars.greyscript]
repository = "https://github.com/ayecue/tree-sitter-miniscript"
commit = "f505f44e7bb67504e40ba683fa67184f14924e85"
```

## 2. Cargo.toml

Zed extensions compile to a WASM CDYLIB. Create `Cargo.toml`:

```toml
[package]
name = "greybel-lsp-zed-extension"
version = "0.0.1"
edition = "2021"

[lib]
path = "src/greyscript.rs"
crate-type = ["cdylib"]

[dependencies]
zed_extension_api = "0.5.0"
```

## 3. Extension Entry Point

Create `src/greyscript.rs`. This installs `greybel-languageserver` via npm and launches it with `--stdio`:

```rust
use std::{env, fs};
use zed_extension_api::{
    self as zed, serde_json, settings::LspSettings, LanguageServerId, Result,
};

const SERVER_PATH: &str = "node_modules/.bin/greybel-languageserver";
const PACKAGE_NAME: &str = "greybel-languageserver";

struct GreyScriptExtension {
    did_find_server: bool,
}

impl GreyScriptExtension {
    fn server_exists(&self) -> bool {
        fs::metadata(SERVER_PATH).map_or(false, |stat| stat.is_file())
    }

    fn server_script_path(
        &mut self,
        language_server_id: &LanguageServerId,
    ) -> Result<String> {
        let server_exists = self.server_exists();
        if self.did_find_server && server_exists {
            return Ok(SERVER_PATH.to_string());
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );
        let version = zed::npm_package_latest_version(PACKAGE_NAME)?;

        if !server_exists
            || zed::npm_package_installed_version(PACKAGE_NAME)?.as_ref()
                != Some(&version)
        {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Downloading,
            );
            let result = zed::npm_install_package(PACKAGE_NAME, &version);
            match result {
                Ok(()) => {
                    if !self.server_exists() {
                        Err(format!(
                            "installed package '{PACKAGE_NAME}' did not contain expected path '{SERVER_PATH}'",
                        ))?;
                    }
                }
                Err(error) => {
                    if !self.server_exists() {
                        Err(error)?;
                    }
                }
            }
        }

        self.did_find_server = true;
        Ok(SERVER_PATH.to_string())
    }
}

impl zed::Extension for GreyScriptExtension {
    fn new() -> Self {
        Self {
            did_find_server: false,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let server_path = self.server_script_path(language_server_id)?;
        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![
                env::current_dir()
                    .unwrap()
                    .join(&server_path)
                    .to_string_lossy()
                    .to_string(),
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        let settings = LspSettings::for_worktree(
            language_server_id.as_ref(),
            worktree,
        )
        .ok()
        .and_then(|lsp_settings| lsp_settings.settings.clone())
        .unwrap_or_default();

        let mut map = serde_json::Map::new();
        map.insert(language_server_id.to_string(), settings);
        Ok(Some(serde_json::json!(map)))
    }
}

zed::register_extension!(GreyScriptExtension);
```

## 4. Language Configuration

Create `languages/greyscript/config.toml`:

```toml
name = "GreyScript"
grammar = "greyscript"
path_suffixes = ["src", "gs", "ms"]
line_comments = ["//"]
block_comment = ["/*", "*/"]
brackets = [
    { start = "{", end = "}", close = true, newline = true },
    { start = "[", end = "]", close = true, newline = true },
    { start = "(", end = ")", close = true, newline = true },
    { start = "\"", end = "\"", close = true, newline = false },
]
```

## 5. Build and Install

Build the extension and install it in Zed.

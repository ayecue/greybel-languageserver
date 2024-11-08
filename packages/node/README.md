# greybel-languageserver

[![greybel-languageserver](https://circleci.com/gh/ayecue/greybel-languageserver.svg?style=svg)](https://circleci.com/gh/ayecue/greybel-languageserver)

Language server for GreyScript. Provides several features such as auto-completion, hover tooltips and more.

Should work with any other client which is following [LSP standards](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide). Feel free to take a look at a full [implementation](https://github.com/ayecue/greybel-vs) into VSCode.

## Supported providers

It supports the following providers:
- completion
- hover
- color
- definition
- formatter
- signature help
- document symbol
- workspace symbol
- diagnostic
- semantic tokens

## Install

```bash
npm install -g greybel-languageserver
```

## Usage
```bash
greybel-languageserver
```

## Example implementations

A collection of IDEs implementing `greybel-languageserver`.

#### VSCode implementation
```ts
import * as path from 'path';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

const serverModule = context.asAbsolutePath(
  path.join('node_modules', 'greybel-languageserver', 'index.js')
);

const serverOptions: ServerOptions = {
  run: { module: serverModule, transport: TransportKind.ipc }
};

const clientOptions: LanguageClientOptions = {
  documentSelector: [{ scheme: 'file', language: 'greyscript' }],
  synchronize: {
    fileEvents: workspace.createFileSystemWatcher('**/*')
  },
  diagnosticCollectionName: 'greyscript'
};

const client = new LanguageClient(
  'languageServerExample',
  'Language Server Example',
  serverOptions,
  clientOptions
);

client.registerProposedFeatures();
client.start();
```

#### Sublime implementation
Install [LSP Package](https://lsp.sublimetext.io/) and create the following configuration:
```json
{
  "show_diagnostics_panel_on_save": 0,
  "clients": {
    "greyscript": {
      "enabled": true,
      "command": ["greybel-languageserver", "--stdio"],
      "selector": "source.greyscript"
    }
  },
  "semantic_highlighting": true
}
```

Sublime syntax file (will highlighting will be done via semantic provider therefore there is no need to add anything here)
```yaml
%YAML 1.2
---
name: greyscript
file_extensions:
  - src
scope: source.greyscript

contexts:
  main:
    - match: '.+'
      scope: text.greyscript
```

#### IntelliJ IDEA
How to setup:
- [Install greybel-languageserver](#install)
- Install the plugin LSP4IJ
- Goto "Languages & Frameworks > Language Servers"
- Click at the "+" icon
- Enter "greyscript" as name
- Enter "greybel-languageserver  --stdio" as command
- Add filename patterns:
  - File name pattern: "*.src"
  - Language Id: "greyscript"
- Restart IntelliJ
- Done

#### nvim
Add the following configuration to `init.vim`.
```vim
" Install vim-plug if it's not already installed
call plug#begin('~/.vim/plugged')

" Install LSP config plugin
Plug 'neovim/nvim-lspconfig'

call plug#end()

" LSP configuration for greybel-languageserver
lua <<EOF
  local configs = require'lspconfig.configs'
  local lspconfig = require'lspconfig'

  -- Enable debug-level logging
  vim.lsp.set_log_level("debug")

  if not configs.greybel then
    configs.greybel = {
      default_config = {
        cmd = { "greybel-languageserver", "--stdio" },
        filetypes = { "src" },
        root_dir = lspconfig.util.root_pattern(".git", vim.fn.getcwd()),
        settings = {},
        on_attach = function(client, bufnr)           -- Optional on_attach function
          -- Set up hover keybinding here
          vim.api.nvim_buf_set_keymap(bufnr, 'n', 'K', '<cmd>lua vim.lsp.buf.hover()<CR>', { noremap = true, silent = true })
        end,
      },
    }
  end

  -- Register and start the greybel LSP
  lspconfig.greybel.setup{}
EOF

autocmd BufRead,BufNewFile *.src set filetype=src
```

## How to add tooltips

You can add your own meta descriptions in [this repository](https://github.com/ayecue/greyscript-meta). The workflow for this is as follows:
- create a PR with your changes in the [meta repository](https://github.com/ayecue/greyscript-meta)
- create a PR with the raised version to this repository

Additionally, there is the option to define methods via comments in the code.

```js
// @type Bar
// @property {string} virtualMoo
Bar = {}
Bar.moo = ""

// Hello world
// I am **bold**
// @description Alternative description
// @example test("title", 123)
// @param {string} title - The title of the book.
// @param {string|number} author - The author of the book.
// @return {Bar} - Some info about return
Bar.test = function(test, abc)
  print "test"
  return self
end function

// @type Foo
Foo = new Bar
// @return {Foo}
Foo.New = function(message)
  result = new Foo
  return result
end function

myVar = Foo.New

myVar.test // shows defined signature of Bar.test on hover
myVar.virtualMoo // shows virtual property of type string on hover
```
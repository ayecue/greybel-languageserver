# greybel-languageserver

[![greybel-languageserver](https://circleci.com/gh/ayecue/greybel-languageserver.svg?style=svg)](https://circleci.com/gh/ayecue/greybel-languageserver)

Language server for GreyScript. Provides several features such as auto-completion, hover tooltips and more.

Feel free to take a look at the [implementation](https://github.com/ayecue/greybel-vs). Should work with any other client which is following [LSP standards](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide).

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

## Install

```bash
npm install -g greybel-languageserver
```

## Usage
```bash
greybel-languageserver
```

## Example implementations

Currently, there are two server client versions. The reason for this is that VSCode supports development in your web browser but also on your local machine.

In case it is required to have the language server running within the context of a browser you have to use the `dist/browser.js` file.

If you want to use the language server for local development go ahead and use `dist/node.js`.

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
  path.join('node_modules', 'greybel-languageserver', 'dist', 'node.js')
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
  }
}
```

Example sublime syntax file (for testing)
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
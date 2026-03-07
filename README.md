# greybel-languageserver

[![greybel-languageserver](https://circleci.com/gh/ayecue/greybel-languageserver.svg?style=svg)](https://circleci.com/gh/ayecue/greybel-languageserver)

A [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) implementation for [GreyScript](https://github.com/ayecue/greybel-js) (the [Grey Hack](https://store.steampowered.com/app/605230/Grey_Hack/) flavour of MiniScript) written in TypeScript. It extends [miniscript-languageserver](../miniscript-languageserver) with GreyScript-specific type information and transpiler integration via [greyscript-core](../greyscript-core), [greyscript-transpiler](../greyscript-transpiler), and [greybel-type-analyzer](../greybel-type-analyzer).

## Features

* Autocompletion with GreyScript type-aware suggestions
* Hover documentation for functions and variables
* Go-to-definition and symbol lookup
* Diagnostics (syntax errors and type warnings)
* Signature help for function calls
* Document and workspace symbol search
* Semantic token highlighting
* Code formatting via the GreyScript transpiler (beautify)
* Color picker support
* Folding ranges
* Configurable type analyzer strategy (dependency-based or workspace-wide)

## Packages

| Package | Description |
|---------|-------------|
| [core](packages/core) | Shared LSP feature implementations for GreyScript |
| [node](packages/node) | Node.js language server binary |
| [browser](packages/browser) | Browser-compatible language server |

## Install

```bash
npm install -g greybel-languageserver
```

## Usage

After installing globally the server can be started from the command line:

```bash
greybel-languageserver --stdio
```

Point your editor's LSP client at this command to enable GreyScript support. For detailed configuration options, see the [node package README](packages/node/README.md).

## Testing

```bash
npm test
```
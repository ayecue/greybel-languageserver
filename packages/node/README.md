# greybel-languageserver

[![greybel-languageserver](https://circleci.com/gh/ayecue/greybel-languageserver.svg?style=svg)](https://circleci.com/gh/ayecue/greybel-languageserver)

greybel-languageserver` is a Language Server for GreyScript that offers a variety of features, including:

- Auto-completion
- Hover tooltips
- Syntax highlighting and more

This language server is compatible with any client that follows the [LSP standards](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide). 

For an example of how it integrates with a popular editor, take a look at the [examples](#example-implementations).

## Supported Providers

`greybel-languageserver` supports the following language server protocol (LSP) features:

- **Completion**: Auto-completion suggestions for code.
- **Hover**: Displays information about a symbol when you hover over it.
- **Color**: Color information for syntax highlighting and theming.
- **Definition**: Navigate to the definition of a symbol.
- **Formatter**: Automatically format the code according to set rules.
- **Signature Help**: Shows function or method signatures while typing.
- **Document Symbol**: Lists all symbols in a document (e.g., functions, classes).
- **Workspace Symbol**: Search for symbols across the workspace.
- **Diagnostic**: Provides error, warning, and information diagnostics.
- **Semantic Tokens**: Enhanced token classification for syntax highlighting and analysis.

## Install

```bash
npm install -g greybel-languageserver
```

## Usage
```bash
greybel-languageserver
```

## Configuration
```ts
{
  fileExtensions: string; // default: "gs,ms,src"
  formatter: boolean; // default: true
  autocomplete: boolean; // default: true
  hoverdocs: boolean; // default: true
  diagnostic: boolean; // default: true
  transpiler: {
    beautify: {
      keepParentheses: boolean; // default: true
      indentation: "Tab" | "Whitespace"; // default: "Tab"
      indentationSpaces: number; // default: 2
    };
  };
  typeAnalyzer: {
    strategy: "Dependency" | "Workspace"; // default: "Dependency"
    exclude?: string; // default: undefined
  };
}
```

## Example Implementations

This section provides a collection of IDEs that implement the `greybel-languageserver`.

- [VSCode](#vscode): Visual Studio Code setup for `greybel-languageserver`.
- [Sublime Text](#sublime): Instructions for integrating with Sublime Text.
- [IntelliJ](#intellij): Guide for using `greybel-languageserver` with IntelliJ.
- [Neovim (nvim)](#nvim): Configuration for Neovim users.
- [Visual Studio](#visual-studio): Learn how to set up a Visual Studio extension using LSP to add support for the GreyScript language in Visual Studio.

Any other IDEs that follow the [LSP standards](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide) should also work with `greybel-languageserver`.

#### VSCode

1. Create language client file.
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

#### Sublime

1. Install the [LSP Package](https://lsp.sublimetext.io/) from the Sublime Text Package Control.
2. Create the following LSP client configuration in your Sublime settings:
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

3. Create a Sublime syntax file for greyscript. The highlighting will be provided via the semantic provider, so there's no need to add additional patterns here. Use the following configuration:
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

#### IntelliJ

To set up `greybel-languageserver` in IntelliJ, follow these steps:

1. [Install greybel-languageserver](#install).
2. Install the `LSP4IJ` plugin from the JetBrains Plugin Marketplace.
3. Go to **Languages & Frameworks > Language Servers**.
4. Click the "+" icon to add a new language server configuration.
5. In the **Name** field, enter `greyscript`.
6. In the **Command** field, enter `greybel-languageserver --stdio`.
7. In the **Filename Patterns** section:
   - Set **File Name Pattern** to `*.src`.
   - Set **Language Id** to `greyscript`.
8. Restart IntelliJ.

You should now have `greybel-languageserver` set up and ready to use with IntelliJ.


#### nvim

1. Add the following configuration to your `init.vim`:
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
        filetypes = { "greyscript" },
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

autocmd BufRead,BufNewFile *.src set filetype=greyscript
```
2. Don't forget to run :PlugInstall to install the necessary plugins.

This configuration ensures that greybel-languageserver will be properly integrated into Neovim, and that .src files will be recognized with the correct syntax highlighting and LSP features.

#### Visual Studio

1. Begin by following the [official Visual Studio Extensibility Tutorial](https://learn.microsoft.com/de-de/visualstudio/extensibility/adding-an-lsp-extension?view=vs-2022#get-started) to create a new Visual Studio extension. This will set up the basic structure for the extension project.
2. In this step, we define a custom content type for the language we are adding (e.g., GreyScript). This will help Visual Studio identify files based on their extension or content type. Create a new class called ContentTypeDefinitions.cs:
```csharp
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Utilities;
using System.ComponentModel.Composition;

namespace GreyScript
{
    internal static class GreyScriptContentDefinition
    {
        [Export]
        [Name("greyscript")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
        public static ContentTypeDefinition GreyScriptContentTypeDefinition;

        [Export]
        [FileExtension(".ms")]
        [ContentType("greyscript")]
        public static FileExtensionToContentTypeDefinition GreyScriptFileExtensionDefinition;
    }
}
```
3. Next, you will create the LanguageClient.cs class that connects Visual Studio to the language server. This class implements ILanguageClient, which is essential for interacting with the LSP. Create a new file called LanguageClient.cs:
```csharp
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.Utilities;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace GreyScript
{
    [Export(typeof(ILanguageClient))]
    [ContentType("greyscript")]
    [RunOnContext(RunningContext.RunOnHost)]
    public class GreyScriptLanguageClient : ILanguageClient
    {
        public event AsyncEventHandler<EventArgs> StartAsync;
        public event AsyncEventHandler<EventArgs> StopAsync;
        public object InitializationOptions => null;
        public IEnumerable<string> FilesToWatch => null;
        public bool ShowNotificationOnInitializeFailed => true;
        public string Name => "GreyScript Language Client";
        public IEnumerable<string> ConfigurationSections => new[] { "greyscript" };

        public Task<Connection> ActivateAsync(CancellationToken token)
        {
            var info = new ProcessStartInfo
            {
                FileName = @"C:\Users\myUser\AppData\Roaming\npm\greybel-languageserver.cmd",
                Arguments = "--stdio",
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            var process = new Process { StartInfo = info };

            if (process.Start())
            {
                Debug.WriteLine("Language server started successfully.");
                return Task.FromResult(new Connection(process.StandardOutput.BaseStream, process.StandardInput.BaseStream));
            }

            Debug.WriteLine("Failed to start language server.");
            return Task.FromResult<Connection>(null);
        }

        public async Task OnLoadedAsync()
        {
            if (StartAsync != null)
            {
                await StartAsync.InvokeAsync(this, EventArgs.Empty);
            }
        }

        public async Task StopServerAsync()
        {
            if (StopAsync != null)
            {
                await StopAsync.InvokeAsync(this, EventArgs.Empty);
            }
        }

        public Task OnServerInitializedAsync()
        {
            return Task.CompletedTask;
        }

        public Task<InitializationFailureContext> OnServerInitializeFailedAsync(ILanguageClientInitializationInfo initializationState)
        {
            string message = "GreyScript failed to activate, now we can't test LSP! :(";
            string exception = initializationState.InitializationException?.ToString() ?? string.Empty;
            message = $"{message}\n {exception}";

            var failureContext = new InitializationFailureContext()
            {
                FailureMessage = message,
            };

            return Task.FromResult(failureContext);
        }
    }
}
```
4. At this point, you have a basic framework for integrating a custom language server into Visual Studio. You can customize the content type, server activation, or extend the language client.

## How to Add Tooltips

Tooltips in `greybel-languageserver` can help provide additional context, such as method descriptions, to users. You can contribute your own tooltips by following this workflow:

1. Fork and create a pull request (PR) with your changes to the [greyscript-meta repository](https://github.com/ayecue/greyscript-meta), where the meta descriptions are stored.
2. Once your changes are merged, create a separate PR in this repository to update the version of `greybel-languageserver` to include the new meta descriptions.

Additionally, you can define method-specific tooltips directly in the code using comments. This allows for quick, tooltips for individual methods.
```js
// @type Bar
// @property {string} virtualMoo
Bar = {}
Bar.moo = ""

// Hello world
// I am **bold**
// @description Alternative description
// @example test("title", 123)
// @param {string} test - The title of the book.
// @param {string|number} abc - The author of the book.
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
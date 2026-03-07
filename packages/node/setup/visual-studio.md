# Visual Studio Setup

1. Begin by following the [official Visual Studio Extensibility Tutorial](https://learn.microsoft.com/de-de/visualstudio/extensibility/adding-an-lsp-extension?view=vs-2022#get-started) to create a new Visual Studio extension.

2. Define a custom content type for GreyScript. Create a new class called `ContentTypeDefinitions.cs`:

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

3. Create the `LanguageClient.cs` class that connects Visual Studio to the language server:

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

4. You now have a basic framework for integrating the language server into Visual Studio. You can customize the content type, server activation, or extend the language client as needed.

import { workspace, ExtensionContext, OutputChannel } from 'vscode';
import { Utils } from 'vscode-uri'

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  Trace,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

function createOutputChannel(name: string): OutputChannel {
  const prefix = name.toUpperCase();

  return {
    name: name,
    append: (value: string): void => {
      console.log(`[${prefix}]`, 'append', value);
    },
    appendLine: (value: string): void => {
      console.log(`[${prefix}]`, 'appendLine', value);
    },
    replace: (value: string): void => {
      console.log(`[${prefix}]`, 'replace', value);
    },
    clear: (): void => {
      console.log(`[${prefix}]`, 'clear');
    },
    show: (column?: any, preserveFocus?: boolean): void => {
      console.log(`[${prefix}]`, 'show', column, preserveFocus);
    },
    hide: (): void => {
      console.log(`[${prefix}]`, 'hide');
    },
    dispose: (): void => {
      console.log(`[${prefix}]`, 'dispose');
    }
  };
}

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = Utils.joinPath(context.extensionUri, 'server.js');
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule.fsPath,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule.fsPath,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009']
      }
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'greyscript' }],
    synchronize: {
      configurationSection: 'greybel',
      fileEvents: workspace.createFileSystemWatcher('**/*')
    },
    diagnosticCollectionName: 'greyscript',
    outputChannel: createOutputChannel('debug'),
    traceOutputChannel: createOutputChannel('trace')
  }

  client = new LanguageClient(
    'greyscript-language-server',
    'GreyScript Language Server',
    serverOptions,
    clientOptions
  );

  // FOR DEBUGGING
  /* client.middleware.sendRequest = (type, params, token, next) => {
    console.log('sendRequest', type, params, token);
    return next(type, params, token);
  }; */

  client.setTrace(Trace.Verbose);
  client.registerProposedFeatures();
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
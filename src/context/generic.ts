import EventEmitter from 'events';
import type {
  ClientCapabilities,
  createConnection,
  InitializeParams,
  InitializeResult
} from 'vscode-languageserver';
import { TextDocumentSyncKind } from 'vscode-languageserver';

import {
  IConfiguration,
  IContext,
  IContextFeatures,
  IFileSystem,
  IndentationType
} from '../types';

function defaultConfig(): IConfiguration {
  return {
    formatter: true,
    autocomplete: true,
    hoverdocs: true,
    diagnostic: true,
    transpiler: {
      beautify: {
        keepParentheses: true,
        indentation: IndentationType.Tab,
        indentationSpaces: 2
      }
    }
  };
}

export abstract class GenericContext extends EventEmitter implements IContext {
  abstract readonly connection: ReturnType<typeof createConnection>;
  abstract readonly fs: IFileSystem;

  protected _features: IContextFeatures;

  constructor() {
    super();

    this._features = {
      configuration: false,
      workspaceFolder: false
    };
  }

  get features() {
    return this._features;
  }

  getConfiguration(): Promise<IConfiguration> {
    if (!this._features.configuration) return Promise.resolve(defaultConfig());
    return this.connection.workspace.getConfiguration('greybel');
  }

  protected configureCapabilties(capabilities: ClientCapabilities) {
    this._features.configuration = !!(
      capabilities.workspace && !!capabilities.workspace.configuration
    );
    this._features.workspaceFolder = !!(
      capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
  }

  protected onInitialize(params: InitializeParams) {
    this.configureCapabilties(params.capabilities);

    const result: InitializeResult = {
      capabilities: {
        completionProvider: {
          triggerCharacters: ['.'],
          resolveProvider: true
        },
        hoverProvider: true,
        colorProvider: true,
        definitionProvider: true,
        documentFormattingProvider: true,
        signatureHelpProvider: {
          triggerCharacters: [',', '(']
        },
        documentSymbolProvider: true,
        diagnosticProvider: {
          identifier: 'greyscript',
          interFileDependencies: false,
          workspaceDiagnostics: false
        },
        textDocumentSync: TextDocumentSyncKind.Incremental
      }
    };

    if (this._features.workspaceFolder) {
      result.capabilities.workspace = {
        workspaceFolders: {
          supported: true
        }
      };
    }

    this.emit('ready', this);

    return result;
  }

  async listen() {
    this.fs.listen(this.connection);
    this.connection.onInitialize(this.onInitialize.bind(this));
    this.connection.listen();
  }
}

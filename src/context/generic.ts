import EventEmitter from 'events';
import type {
  ClientCapabilities,
  createConnection,
  InitializedParams,
  InitializeParams,
  InitializeResult
} from 'vscode-languageserver';

import {
  ConfigurationNamespace,
  IConfiguration,
  IContext,
  IContextFeatures,
  IFileSystem,
  IndentationType,
  LanguageId
} from '../types';

function createConfig(preset?: IConfiguration): IConfiguration {
  return {
    formatter: preset?.formatter ?? true,
    autocomplete: preset?.autocomplete ?? true,
    hoverdocs: preset?.hoverdocs ?? true,
    diagnostic: preset?.diagnostic ?? true,
    transpiler: {
      beautify: {
        keepParentheses: preset?.transpiler?.beautify?.keepParentheses ?? true,
        indentation:
          preset?.transpiler?.beautify?.indentation ?? IndentationType.Tab,
        indentationSpaces: preset?.transpiler?.beautify?.indentationSpaces ?? 2
      }
    }
  };
}

export abstract class GenericContext extends EventEmitter implements IContext {
  abstract readonly connection: ReturnType<typeof createConnection>;
  abstract readonly fs: IFileSystem;

  protected _features: IContextFeatures;
  protected _configuration: IConfiguration;

  constructor() {
    super();

    this._configuration = createConfig();
    this._features = {
      configuration: false,
      workspaceFolder: false
    };
  }

  get features() {
    return this._features;
  }

  getConfiguration(): IConfiguration {
    return this._configuration;
  }

  protected async syncConfiguraton() {
    const configuration: IConfiguration =
      await this.connection.workspace.getConfiguration(ConfigurationNamespace);
    this._configuration = createConfig(configuration);
  }

  protected configureCapabilties(capabilities: ClientCapabilities) {
    this._features.configuration = !!(
      capabilities.workspace && !!capabilities.workspace.configuration
    );
    this._features.workspaceFolder = !!(
      capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
  }

  protected async onInitialize(params: InitializeParams) {
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
        workspaceSymbolProvider: true,
        diagnosticProvider: {
          identifier: LanguageId,
          interFileDependencies: false,
          workspaceDiagnostics: false
        },
        textDocumentSync: 2 // incremental
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

  protected async onInitialized(_params: InitializedParams) {
    if (this._features.configuration) {
      await this.syncConfiguraton();
      this.connection.onDidChangeConfiguration(async () => {
        const oldConfiguration = this._configuration;
        await this.syncConfiguraton();
        this.emit(
          'configuration-change',
          this,
          this._configuration,
          oldConfiguration
        );
      });
    }

    this.emit('loaded', this);
  }

  async listen() {
    this.fs.listen(this.connection);
    this.connection.onInitialize(this.onInitialize.bind(this));
    this.connection.onInitialized(this.onInitialized.bind(this));
    this.connection.listen();
  }
}

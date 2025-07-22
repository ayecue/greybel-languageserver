import EventEmitter from 'events';
import type {
  ClientCapabilities,
  createConnection,
  InitializedParams,
  InitializeParams,
  InitializeResult,
  SemanticTokensBuilder
} from 'vscode-languageserver';

import {
  ConfigurationNamespace,
  DefaultFileExtensions,
  IConfiguration,
  IConfigurationRequest,
  IContext,
  IContextFeatures,
  IFileSystem,
  IndentationType,
  LanguageId,
  TypeAnalyzerStrategy
} from './types';
import { DocumentMerger } from './helper/document-merger';
import { DocumentManager } from './helper/document-manager';
import { semanticTokensLegend } from './helper/semantic-token-builder';

function createConfig(preset?: IConfigurationRequest): IConfiguration {
  return {
    fileExtensions: preset?.fileExtensions ? preset.fileExtensions.split(',') : DefaultFileExtensions,
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
    },
    typeAnalyzer: {
      strategy: preset?.typeAnalyzer?.strategy ?? TypeAnalyzerStrategy.Dependency,
      exclude: preset?.typeAnalyzer?.exclude ?? undefined
    }
  };
}

export abstract class CoreContext extends EventEmitter implements IContext {
  abstract readonly connection: ReturnType<typeof createConnection>;
  abstract readonly fs: IFileSystem;
  abstract readonly documentManager: DocumentManager;
  abstract readonly documentMerger: DocumentMerger;
  abstract createSemanticTokensBuilder(): SemanticTokensBuilder;

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
    const configuration: IConfigurationRequest =
      await this.connection.workspace.getConfiguration(ConfigurationNamespace);
    const newConfiguration = createConfig(configuration);

    // check for analyzer changes to clear type analyzer cache
    const newTypeAnalyzerConfig = newConfiguration.typeAnalyzer;
    const oldTypeAnalyzerConfig = this._configuration.typeAnalyzer;

    if (newTypeAnalyzerConfig.strategy !== oldTypeAnalyzerConfig.strategy || newTypeAnalyzerConfig.exclude !== oldTypeAnalyzerConfig.exclude) {
      this.documentMerger.cache.flushCache();
    }

    this._configuration = newConfiguration;
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
        foldingRangeProvider: true,
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
        semanticTokensProvider: {
          legend: {
            tokenTypes: semanticTokensLegend.tokenTypes,
            tokenModifiers: semanticTokensLegend.tokenModifiers,
          },
          full: true
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

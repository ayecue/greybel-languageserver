import crlf, { LF } from 'crlf-normalize';
import EventEmitter from 'events';
// @ts-ignore: No type definitions
import { TextDecoderLite as TextDecoder } from 'text-encoder-lite';
import {
  ClientCapabilities,
  createConnection,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { IContext, IContextFeatures } from './types';

export class Context extends EventEmitter implements IContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly textDocumentManager: TextDocuments<TextDocument>;
  private _features: IContextFeatures;

  constructor() {
    super();

    this.connection = createConnection(
      ProposedFeatures.all
    );
    this.textDocumentManager = new TextDocuments(
      TextDocument
    );
    this._features = {
      configuration: false,
      workspaceFolder: false,
      diagnosticRelatedInformation: false
    };
  }

  async getWorkspaceFolderUris(): Promise<URI[]> {
    const result = await this.connection.workspace.getWorkspaceFolders();
    return Array.from(new Set(result.map((it) => it.uri))).map((it) => URI.parse(it));
  }

  private configureCapabilties(capabilities: ClientCapabilities) {
    this._features.configuration = !!(
      capabilities.workspace && !!capabilities.workspace.configuration
    );
    this._features.workspaceFolder = !!(
      capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    this._features.diagnosticRelatedInformation = !!(
      capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
    );
  }

  private onInitialize(params: InitializeParams) {
    this.configureCapabilties(params.capabilities);

    const result: InitializeResult = {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      capabilities: {
        completionProvider: {
          resolveProvider: true
        }
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

  findExistingPath(...uris: string[]): string {
    if (uris.length === 0) {
      return '';
    }

    for (let index = 0; index < uris.length; index++) {
      const item = this.textDocumentManager.get(uris[index])
      if (item != null) return uris[index];
    }

    return uris[0];
  }

  readFile(targetUri: string): string {
    try {
      const textDocument = this.textDocumentManager.get(targetUri);
      return crlf(textDocument.getText(), LF);
    } catch (err) {
      console.error(err);
    }
  }

  async listen() {
    this.connection.onInitialize(this.onInitialize.bind(this));
    this.textDocumentManager.listen(this.connection);
    this.connection.listen();
  }
}

export default new Context();
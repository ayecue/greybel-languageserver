import crlf, { LF } from 'crlf-normalize';
import EventEmitter from 'events';
import fs from 'fs';
// @ts-ignore: No type definitions
import { TextDecoderLite as TextDecoder } from 'text-encoder-lite';
import {
  ClientCapabilities,
  createConnection,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  TextDocumentChangeEvent
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { IContext, IContextFeatures } from './types';

export class Context extends EventEmitter implements IContext {
  readonly connection: ReturnType<typeof createConnection>;

  private _textDocumentManager: TextDocuments<TextDocument>;
  private _features: IContextFeatures;

  constructor() {
    super();

    this.connection = createConnection(
      ProposedFeatures.all
    );
    this._textDocumentManager = new TextDocuments(
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

  findExistingPath(...uris: string[]): string {
    if (uris.length === 0) {
      return '';
    }

    for (let index = 0; index < uris.length; index++) {
      const item = this.getTextDocument(uris[index])
      if (item != null) return uris[index];
    }

    return uris[0];
  }

  getAllTextDocuments(): TextDocument[] {
    return this._textDocumentManager.all();
  }

  async getTextDocument(targetUri: string): Promise<TextDocument> {
    const textDocument = this._textDocumentManager.get(targetUri);
    if (textDocument) return textDocument;
    const uri = URI.parse(targetUri);
    if (uri.scheme == 'file') {
      try {
        const out = await fs.promises.readFile(uri.fsPath);
        const content = new TextDecoder().decode(out);
        return TextDocument.create(targetUri, 'greyscript', 0, content);
      } catch (err) {
      }
    }
    return null;
  }

  async readFile(targetUri: string): Promise<string> {
    const document = await this.getTextDocument(targetUri);
    return document.getText();
  }

  async listen() {
    this.connection.onInitialize(this.onInitialize.bind(this));
    this._textDocumentManager.listen(this.connection);
    this._textDocumentManager.onDidOpen(
      (event: TextDocumentChangeEvent<TextDocument>) => {
        this.emit('textDocument-open', event.document);
      }
    );
    this._textDocumentManager.onDidChangeContent(
      (event: TextDocumentChangeEvent<TextDocument>) => {
        this.emit('textDocument-change', event.document);
      }
    );
    this._textDocumentManager.onDidClose(
      (event: TextDocumentChangeEvent<TextDocument>) => {
        this.emit('textDocument-close', event.document);
      }
    );
    this.connection.listen();
  }
}

export default new Context();
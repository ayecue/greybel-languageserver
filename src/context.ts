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
  TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { IContext, IContextFeatures } from './types';

export class Context extends EventEmitter implements IContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly textDocumentManager: TextDocuments<TextDocument>;

  private _workspaceFolderUris: Set<string>;
  private _features: IContextFeatures;

  constructor() {
    super();

    this.connection = createConnection(
      ProposedFeatures.all
    );
    this.textDocumentManager = new TextDocuments(
      TextDocument
    );
    this._workspaceFolderUris = new Set();
    this._features = {
      configuration: false,
      workspaceFolder: false,
      diagnosticRelatedInformation: false
    };
  }

  private async fetchWorkspaceFolders(): Promise<void> {
    const result = await this.connection.workspace.getWorkspaceFolders();
    this._workspaceFolderUris = new Set(result.map((it) => it.uri));
  }

  getWorkspaceFolderUris(): URI[] {
    return Array.from(this._workspaceFolderUris).map((it) => {
      return URI.parse(it);
    });
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

  private async registerWorkspaceFeature() {
    await this.fetchWorkspaceFolders();
    this.connection.workspace.onDidChangeWorkspaceFolders((event) => {
      for (let index = 0; index < event.removed.length; index++)
        this._workspaceFolderUris.delete(event.removed[index].uri);
      for (let index = 0; index < event.added.length; index++)
        this._workspaceFolderUris.add(event.added[index].uri);
    });
  }

  private async onInitialize(params: InitializeParams) {
    this.configureCapabilties(params.capabilities);

    const result: InitializeResult = {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      capabilities: {
        completionProvider: {
          resolveProvider: true
        },
        workspace: {
          workspaceFolders: {
            supported: true,
            changeNotifications: true
          }
        }
      }
    };

    if (this._features.workspaceFolder) {
      result.capabilities.workspace = {
        workspaceFolders: {
          supported: true
        }
      };
      await this.registerWorkspaceFeature();
    }

    this.emit('ready', this);

    return result;
  }

  findExistingPath(...uris: string[]): string {
    if (uris.length === 0) {
      return '';
    }

    for (let index = 0; index < uris.length; index++) {
      if (fs.existsSync(uris[index])) return uris[index];
    }

    return uris[0];
  }

  readFile(targetUri: string): string {
    try {
      const buffer = fs.readFileSync(targetUri);
      const content = new TextDecoder().decode(buffer);
      return crlf(content, LF);
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

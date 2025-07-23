import { createConnection, TextDocumentChangeEvent, TextDocuments } from "vscode-languageserver/browser";
import { TextDocument } from "vscode-languageserver-textdocument";
import EventEmitter from "events";
import { URI } from "vscode-uri";
import { LRUCache } from "lru-cache";

import { IContext, IFileSystem, LanguageId } from "greybel-languageserver-core";

export enum FileSystemRequest {
  FileContent = 'read-file',
  FindFiles = 'find-files'
}

export class FileSystem extends EventEmitter implements IFileSystem {
  private _context: IContext;
  private _tempTextDocumentCache: LRUCache<string, TextDocument>;
  private _textDocumentManager: TextDocuments<TextDocument>;
  private _connection: ReturnType<typeof createConnection> | null;

  constructor(context: IContext) {
    super();

    this._connection = null;
    this._context = context;
    this._textDocumentManager = new TextDocuments(
      TextDocument
    );
    this._tempTextDocumentCache = new LRUCache({
      ttl: 1000,
      max: 100
    });
  }

  async getWorkspaceFolderUris(): Promise<URI[]> {
    if (!this._context.features.workspaceFolder) return [];
    const result = await this._connection?.workspace?.getWorkspaceFolders();
    if (result == null) return [];
    return Array.from(new Set(result.map((it) => it.uri))).map((it) => URI.parse(it));
  }

  async getWorkspaceFolderUri(source: URI): Promise<URI | null> {
    const uris = await this.getWorkspaceFolderUris();
    return uris.find(folderUri => source.path.startsWith(folderUri.path)) || null;
  }

  private async requestFindFiles(include: string, exclude?: string): Promise<string[]> {
    const method = `custom/${FileSystemRequest.FindFiles}`;

    try {
      return await this._context.connection.sendRequest(method, JSON.stringify({ include, exclude }));
    } catch (err) {
      console.error(`Cannot fetch workspace files! Maybe the client does not support ${method}`, err);
      return [];
    }
  }

  async getWorkspaceRelatedFiles(): Promise<URI[]> {
    const configuration = this._context.getConfiguration();
    const fileExtensions = configuration.fileExtensions;
    const exclude = configuration.typeAnalyzer.exclude;
    const filePaths = await this.requestFindFiles(`**/*.{${fileExtensions.join(',')}}`, exclude);
    return filePaths.map((it) => URI.parse(it));
  }

  async getWorkspaceFileUris(pattern: string, exclude?: string): Promise<URI[]> {
    const filePaths = await this.requestFindFiles(pattern, exclude);
    return filePaths.map((it) => URI.parse(it));
  }

  async findExistingPath(mainUri: string, ...altUris: string[]): Promise<string | null> {
    const mainItem = await this.getTextDocument(mainUri);
    if (mainItem != null) return mainUri;

    if (altUris.length === 0) {
      return null;
    }

    try {
      const altItemUri = await Promise.any(
        altUris.map(async (uri) => {
          const item = await this.getTextDocument(uri);
          if (item != null) return uri;
          throw new Error('Alternative path could not resolve');
        })
      );

      if (altItemUri != null) {
        return altItemUri;
      }

      return null;
    } catch (err) {
      return null;
    }
  }

  getAllTextDocuments(): TextDocument[] {
    return this._textDocumentManager.all();
  }

  private async requestFileContent(fileUri: URI): Promise<string | null> {
    const method = `custom/${FileSystemRequest.FileContent}`;

    try {
      return await this._context.connection.sendRequest(method, JSON.stringify({ uri: fileUri.toString() }));
    } catch (err) {
      console.error(`Cannot fetch text document! Maybe the client does not support ${method}`, err);
      return null;
    }
  }

  async fetchTextDocument(targetUri: string): Promise<TextDocument | null> {
    const uri = URI.parse(targetUri);
    const cachedTextDocument = this._tempTextDocumentCache.get(targetUri);

    if (cachedTextDocument != null) {
      return cachedTextDocument;
    }

    let tempDoc: TextDocument | null = null;
    const content = await this.requestFileContent(uri);

    if (content != null) {
      tempDoc = TextDocument.create(targetUri, LanguageId, 0, content);
      this._connection?.sendNotification('textDocument/didOpen', {
        textDocument: tempDoc
      });
    }

    this._tempTextDocumentCache.set(targetUri, tempDoc);

    return tempDoc;
  }

  async getTextDocument(targetUri: string): Promise<TextDocument | null> {
    const textDocument = this._textDocumentManager.get(targetUri);
    if (textDocument) return textDocument;
    const uri = URI.parse(targetUri);
    if (uri.scheme == 'file') return await this.fetchTextDocument(targetUri);
    return null;
  }

  async readFile(targetUri: string): Promise<string> {
    const document = await this.getTextDocument(targetUri);
    return document.getText();
  }

  listen(connection: ReturnType<typeof createConnection>) {
    this._connection = connection;
    this._textDocumentManager.listen(connection);
    this._textDocumentManager.onDidOpen(
      (event: TextDocumentChangeEvent<TextDocument>) => {
        this.emit('text-document-open', event.document);
      }
    );
    this._textDocumentManager.onDidChangeContent(
      (event: TextDocumentChangeEvent<TextDocument>) => {
        this.emit('text-document-change', event.document);
      }
    );
    this._textDocumentManager.onDidClose(
      (event: TextDocumentChangeEvent<TextDocument>) => {
        this.emit('text-document-close', event.document);
      }
    );
  }
}
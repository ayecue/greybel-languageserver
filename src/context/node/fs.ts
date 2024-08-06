import { createConnection, TextDocumentChangeEvent, TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import EventEmitter from "events";
import { URI } from "vscode-uri";
import fs from "fs";

import { IFileSystem } from "../../types";
import LRUCache from "lru-cache";

export class FileSystem extends EventEmitter implements IFileSystem {
  private _tempTextDocumentCache: LRUCache<string, TextDocument>;
  private _textDocumentManager: TextDocuments<TextDocument>;
  private _workspace: ReturnType<typeof createConnection>['workspace'];

  constructor() {
    super();

    this._textDocumentManager = new TextDocuments(
      TextDocument
    );
    this._tempTextDocumentCache = new LRUCache({
      ttl: 1000,
      max: 100
    });
  }

  async getWorkspaceFolderUris(): Promise<URI[]> {
    const result = await this._workspace.getWorkspaceFolders();
    return Array.from(new Set(result.map((it) => it.uri))).map((it) => URI.parse(it));
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

  async fetchTextDocument(targetUri: string): Promise<TextDocument> {
    const uri = URI.parse(targetUri);
    const cachedTextDocument = this._tempTextDocumentCache.get(targetUri);

    if (cachedTextDocument != null) {
      return cachedTextDocument;
    }

    let tempDoc: TextDocument | null = null;

    try {
      const out = await fs.promises.readFile(uri.fsPath);
      const content = new TextDecoder().decode(out);

      tempDoc = TextDocument.create(targetUri, 'greyscript', 0, content);
    } catch (err) { }

    this._tempTextDocumentCache.set(targetUri, tempDoc);

    return tempDoc;
  }

  async getTextDocument(targetUri: string): Promise<TextDocument> {
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
    this._workspace = connection.workspace;
    this._textDocumentManager.listen(connection);
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
  }
}
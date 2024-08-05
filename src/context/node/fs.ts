import { createConnection, TextDocumentChangeEvent, TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import EventEmitter from "events";
import { URI } from "vscode-uri";
import fs from "fs";

import { IFileSystem } from "../../types";

export class FileSystem extends EventEmitter implements IFileSystem {
  private _textDocumentManager: TextDocuments<TextDocument>;
  private _workspace: ReturnType<typeof createConnection>['workspace'];

  constructor() {
    super();

    this._textDocumentManager = new TextDocuments(
      TextDocument
    );
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
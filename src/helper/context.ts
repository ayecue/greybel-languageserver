import crlf, { LF } from 'crlf-normalize';
import EventEmitter from 'events';
import fs from 'fs';
// @ts-ignore: No type definitions
import { TextDecoderLite as TextDecoder } from 'text-encoder-lite';
import {
  createConnection,
  ProposedFeatures,
  TextDocuments
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';

export class Context extends EventEmitter {
  readonly connection: ReturnType<typeof createConnection> = createConnection(
    ProposedFeatures.all
  );

  readonly textDocumentManager: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument
  );

  private _workspaceFolderUris: Set<string> = new Set();

  getWorkspaceFolderUris(): URI[] {
    return Array.from(this._workspaceFolderUris).map((it) => {
      return URI.parse(it);
    });
  }

  async readFile(targetUri: string): Promise<Uint8Array | null> {
    try {
      return fs.readFileSync(targetUri);
    } catch (err) {
      console.error(err);
    }

    return null;
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

  decodeFile(targetUri: string): string {
    const out = this.readFile(targetUri);

    if (out) {
      const content = new TextDecoder().decode(out);
      return crlf(content, LF);
    }

    return '';
  }

  private async fetchWorkspaceFolders(): Promise<void> {
    const result = await this.connection.workspace.getWorkspaceFolders();
    this._workspaceFolderUris = new Set(result.map((it) => it.uri));
  }

  private addInternalListener() {
    this.connection.workspace.onDidChangeWorkspaceFolders((event) => {
      for (let index = 0; index < event.removed.length; index++)
        this._workspaceFolderUris.delete(event.removed[index].uri);
      for (let index = 0; index < event.added.length; index++)
        this._workspaceFolderUris.add(event.added[index].uri);
    });
  }

  async listen() {
    this.addInternalListener();
    await this.fetchWorkspaceFolders();
    this.textDocumentManager.listen(this.connection);
    this.connection.listen();
  }
}

export default new Context();

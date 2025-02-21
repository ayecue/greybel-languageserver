
import { createConnection, TextDocumentChangeEvent, TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import EventEmitter from "events";
import { URI } from "vscode-uri";
import fs from "fs";
import { glob } from 'glob';

import { IContext, IFileSystem, LanguageId } from '../../packages/core/src';
import LRUCache from "lru-cache";

export class FileSystem extends EventEmitter implements IFileSystem {
  private _context: IContext;
  private _tempTextDocumentCache: LRUCache<string, TextDocument | null>;
  private _textDocumentManager: TextDocuments<TextDocument>;
  private _workspace: ReturnType<typeof createConnection>['workspace'] | null;

  constructor(context: IContext) {
    super();

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
    if (!this._workspace) return [];
    const result = await this._workspace.getWorkspaceFolders();
    if (result == null) return [];
    return Array.from(new Set(result.map((it) => it.uri))).map((it) => URI.parse(it));
  }

  async getWorkspaceFolderUri(source: URI): Promise<URI | null> {
    const uris = await this.getWorkspaceFolderUris();
    return uris.find(folderUri => source.path.startsWith(folderUri.path)) || null;
  }

  async getWorkspaceRelatedFiles(): Promise<URI[]> {
    const configuration = this._context.getConfiguration();
    const fileExtensions = configuration.fileExtensions;
    const exclude = configuration.typeAnalyzer.exclude;
    const folderUris = await this.getWorkspaceFolderUris();
    const filePaths: string[][] = await Promise.all(folderUris.flatMap(async (folderUri) => {
      return glob(fileExtensions.map((ext) => {
        return `**/*.${ext}`;
      }), { cwd: folderUri.fsPath, absolute: true, ignore: exclude });
    }));
    return filePaths.flat().map((it) => URI.file(it));
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

  async fetchTextDocument(targetUri: string): Promise<TextDocument | null> {
    const uri = URI.parse(targetUri);
    const cachedTextDocument = this._tempTextDocumentCache.get(targetUri);

    if (cachedTextDocument != null) {
      return cachedTextDocument;
    }

    let tempDoc: TextDocument | null = null;

    try {
      const content = await fs.promises.readFile(uri.fsPath, { encoding: 'utf-8' });
      tempDoc = TextDocument.create(targetUri, LanguageId, 0, content);
    } catch (err) {
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
    if (document == null) return '';
    return document.getText();
  }

  listen(connection: ReturnType<typeof createConnection>) {
    this._workspace = connection.workspace;
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

import EventEmitter from 'events';
import { ASTChunkGreyScript, Parser } from 'greyscript-core';
import { LRUCache as LRU } from 'lru-cache';
import { schedule } from 'non-blocking-schedule';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { IContext, IDocumentManager } from '../types';
import { ActiveDocument } from './document-manager/active-document';
import { DocumentScheduler } from './document-manager/document-scheduler';
import typeManager from './type-manager';

export class DocumentManager extends EventEmitter implements IDocumentManager {
  readonly documents: LRU<string, ActiveDocument>;

  private _context: IContext | null;
  private _documentScheduler: DocumentScheduler;
  private _pendingFiles: Map<string, Promise<TextDocument | null>>;

  get context() {
    return this._context;
  }

  setContext(context: IContext) {
    this._context = context;
    return this;
  }

  constructor(processingTimeout?: number) {
    super();
    this._context = null;
    this._pendingFiles = new Map();
    this.documents = new LRU({
      ttl: 1000 * 60 * 20,
      ttlAutopurge: true
    });
    this._documentScheduler = new DocumentScheduler(processingTimeout);

    this.initEvents();
  }

  private initEvents() {
    this._documentScheduler.on('process', (document: TextDocument) => {
      this.processAndPersist(document);
    });
  }

  private processAndPersist(document: TextDocument): ActiveDocument {
    const key = document.uri;

    this._documentScheduler.cancel(document);
    const result = this.process(document);
    this.documents.set(key, result);
    this.emit('processed', document, result);

    return result;
  }

  private process(textDocument: TextDocument): ActiveDocument {
    this._context.documentMerger.cache.flushCacheKey(textDocument.uri);

    const content = textDocument.getText();
    const parser = new Parser(content, {
      unsafe: true
    });
    const parsedPayload = parser.parseChunk() as ASTChunkGreyScript;
    const typeDocument = typeManager.analyze(textDocument.uri, parsedPayload);

    return new ActiveDocument({
      context: this._context,
      version: textDocument.version,
      textDocument,
      typeDocument,
      parsedPayload,
      errors: [...parser.lexer.errors, ...parser.errors]
    });
  }

  schedule(textDocument: TextDocument): boolean {
    if (
      this.documents.get(textDocument.uri)?.version === textDocument.version
    ) {
      return false;
    }

    return this._documentScheduler.schedule(textDocument);
  }

  private async open(target: string): Promise<ActiveDocument | null> {
    try {
      const pendingFile = this._pendingFiles.get(target);
      let textDocument: TextDocument;

      if (pendingFile) {
        textDocument = await pendingFile;
      } else {
        const defer = this.context.fs.getTextDocument(target);
        this._pendingFiles.set(target, defer);
        textDocument = await defer;
      }

      if (textDocument == null) {
        return null;
      }

      return (
        this.documents.get(textDocument.uri) ||
        this.processAndPersist(textDocument)
      );
    } catch (err) {
      return null;
    } finally {
      this._pendingFiles.delete(target);
    }
  }

  async getOrOpen(target: string): Promise<ActiveDocument | null> {
    const document = this.documents.get(target);

    if (document) {
      return document;
    }

    return this.open(target);
  }

  get(textDocument: TextDocument): ActiveDocument {
    return (
      this.documents.get(textDocument.uri) ||
      this.processAndPersist(textDocument)
    );
  }

  getLatest(
    document: TextDocument,
    timeout: number = 5000
  ): Promise<ActiveDocument> {
    return new Promise((resolve) => {
      schedule(() => {
        if (!this._documentScheduler.isScheduled(document)) {
          return resolve(this.get(document));
        }

        const onTimeout = () => {
          this.removeListener('processed', onProcessed);
          resolve(this.get(document));
        };
        const onProcessed = (evDocument: TextDocument) => {
          if (evDocument.uri === document.uri) {
            this.removeListener('processed', onProcessed);
            clearTimeout(timer);
            resolve(this.get(document));
          }
        };
        const timer = setTimeout(onTimeout, timeout);

        this.addListener('processed', onProcessed);
      });
    });
  }

  clear(document: TextDocument): void {
    this.documents.delete(document.uri);
    this.emit('cleared', document);
  }
}

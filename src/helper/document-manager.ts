import EventEmitter from 'events';
import { ASTChunkGreyScript, Parser } from 'greyscript-core';
import LRU from 'lru-cache';
import { ASTBaseBlockWithScope } from 'miniscript-core';
import { schedule } from 'non-blocking-schedule';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';

import { IContext } from '../types';
import typeManager from './type-manager';

export interface ActiveDocumentOptions {
  documentManager: DocumentManager;
  content: string;
  textDocument: TextDocument;
  document: ASTBaseBlockWithScope | null;
  errors: Error[];
}

export class ActiveDocument {
  documentManager: DocumentManager;
  content: string;
  textDocument: TextDocument;
  document: ASTBaseBlockWithScope | null;
  errors: Error[];

  private dependencies?: string[];

  constructor(options: ActiveDocumentOptions) {
    this.documentManager = options.documentManager;
    this.content = options.content;
    this.textDocument = options.textDocument;
    this.document = options.document;
    this.errors = options.errors;
  }

  async getDependencies(): Promise<string[]> {
    if (this.document == null) {
      return [];
    }

    if (this.dependencies) {
      return this.dependencies;
    }

    const rootChunk = this.document as ASTChunkGreyScript;
    const rootPath = Utils.joinPath(URI.parse(this.textDocument.uri), '..');
    const context = this.documentManager.context;
    const workspacePaths = await context.fs.getWorkspaceFolderUris();
    const nativeImports = rootChunk.nativeImports
      .filter((nativeImport) => nativeImport.directory)
      .map((nativeImport) => {
        if (nativeImport.directory.startsWith('/')) {
          return Utils.joinPath(
            workspacePaths[0],
            nativeImport.directory
          ).toString();
        }
        return Utils.joinPath(rootPath, nativeImport.directory).toString();
      });
    const importsAndIncludes = [
      ...rootChunk.imports
        .filter((nonNativeImport) => nonNativeImport.path)
        .map((nonNativeImport) => {
          if (nonNativeImport.path.startsWith('/')) {
            return context.fs.findExistingPath(
              Utils.joinPath(
                workspacePaths[0],
                nonNativeImport.path
              ).toString(),
              Utils.joinPath(
                workspacePaths[0],
                `${nonNativeImport.path}.src`
              ).toString()
            );
          }
          return context.fs.findExistingPath(
            Utils.joinPath(rootPath, nonNativeImport.path).toString(),
            Utils.joinPath(rootPath, `${nonNativeImport.path}.src`).toString()
          );
        }),
      ...rootChunk.includes
        .filter((includeImport) => includeImport.path)
        .map((includeImport) => {
          if (includeImport.path.startsWith('/')) {
            return context.fs.findExistingPath(
              Utils.joinPath(workspacePaths[0], includeImport.path).toString(),
              Utils.joinPath(
                workspacePaths[0],
                `${includeImport.path}.src`
              ).toString()
            );
          }
          return context.fs.findExistingPath(
            Utils.joinPath(rootPath, includeImport.path).toString(),
            Utils.joinPath(rootPath, `${includeImport.path}.src`).toString()
          );
        })
    ];
    const dependencies: Set<string> = new Set([
      ...nativeImports,
      ...importsAndIncludes
    ]);

    this.dependencies = Array.from(dependencies);

    return this.dependencies;
  }

  async getImports(): Promise<ActiveDocument[]> {
    if (this.document == null) {
      return [];
    }

    const imports: Set<ActiveDocument> = new Set();
    const visited: Set<string> = new Set([this.textDocument.uri]);
    const traverse = async (rootResult: ActiveDocument) => {
      const dependencies = await rootResult.getDependencies();

      for (const dependency of dependencies) {
        if (visited.has(dependency)) continue;

        const item = await this.documentManager.open(dependency);

        visited.add(dependency);

        if (item === null) continue;

        imports.add(item);

        if (item.document !== null) {
          await traverse(item);
        }
      }
    };

    await traverse(this);

    return Array.from(imports);
  }
}

export interface QueueItem {
  document: TextDocument;
  createdAt: number;
}

export const DOCUMENT_PARSE_QUEUE_PARSE_TIMEOUT = 100;

export class DocumentManager extends EventEmitter {
  readonly results: LRU<string, ActiveDocument>;

  private _context: IContext | null;
  private queue: Map<string, QueueItem>;
  private tickRef: () => void;
  private timer: NodeJS.Timeout | null;
  private readonly parseTimeout: number;

  get context() {
    return this._context;
  }

  setContext(context: IContext) {
    this._context = context;
    return this;
  }

  constructor(parseTimeout: number = DOCUMENT_PARSE_QUEUE_PARSE_TIMEOUT) {
    super();
    this._context = null;
    this.results = new LRU({
      ttl: 1000 * 60 * 20,
      ttlAutopurge: true
    });
    this.queue = new Map();
    this.tickRef = this.tick.bind(this);
    this.timer = setTimeout(this.tickRef, 0);
    this.parseTimeout = parseTimeout;
  }

  private tick() {
    const currentTime = Date.now();
    const items = Array.from(this.queue.values());

    for (let index = 0; index < items.length; index) {
      const item = items[index];
      if (currentTime - item.createdAt > this.parseTimeout) {
        schedule(() => this.refresh(item.document));
      }
    }

    this.timer = setTimeout(this.tickRef, 0);
  }

  refresh(document: TextDocument): ActiveDocument {
    const key = document.uri;

    if (!this.queue.has(key) && this.results.has(key)) {
      return this.results.get(key)!;
    }

    const result = this.create(document);
    this.results.set(key, result);
    this.emit('parsed', document, result);
    this.queue.delete(key);

    return result;
  }

  private create(document: TextDocument): ActiveDocument {
    const content = document.getText();
    const parser = new Parser(content, {
      unsafe: true
    });
    const chunk = parser.parseChunk() as ASTChunkGreyScript;

    if (chunk.body?.length > 0) {
      typeManager.analyze(document.uri, chunk);

      return new ActiveDocument({
        documentManager: this,
        content,
        textDocument: document,
        document: chunk,
        errors: [...parser.lexer.errors, ...parser.errors]
      });
    }

    try {
      const strictParser = new Parser(document.getText());
      const strictChunk = strictParser.parseChunk() as ASTChunkGreyScript;

      typeManager.analyze(document.uri, strictChunk);

      return new ActiveDocument({
        documentManager: this,
        content,
        textDocument: document,
        document: strictChunk,
        errors: []
      });
    } catch (err: any) {
      return new ActiveDocument({
        documentManager: this,
        content,
        textDocument: document,
        document: null,
        errors: [err]
      });
    }
  }

  update(document: TextDocument): boolean {
    const fileUri = document.uri;
    const content = document.getText();

    if (this.queue.has(fileUri)) {
      return false;
    }

    if (this.results.get(fileUri)?.content === content) {
      return false;
    }

    this.queue.set(fileUri, {
      document,
      createdAt: Date.now()
    });

    return true;
  }

  async open(target: string): Promise<ActiveDocument | null> {
    try {
      const textDocument = await this.context.fs.getTextDocument(target);
      return this.get(textDocument);
    } catch (err) {
      return null;
    }
  }

  get(document: TextDocument): ActiveDocument {
    return this.results.get(document.uri) || this.refresh(document);
  }

  next(
    document: TextDocument,
    timeout: number = 5000
  ): Promise<ActiveDocument> {
    const me = this;

    if (me.queue.has(document.uri)) {
      return new Promise((resolve) => {
        const onTimeout = () => {
          me.removeListener('parsed', onParse);
          resolve(me.get(document));
        };
        const onParse = (evDocument: TextDocument) => {
          if (evDocument.uri === document.uri) {
            me.removeListener('parsed', onParse);
            clearTimeout(timer);
            resolve(me.get(document));
          }
        };
        const timer = setTimeout(onTimeout, timeout);

        me.addListener('parsed', onParse);
      });
    }

    return Promise.resolve(me.get(document));
  }

  clear(document: TextDocument): void {
    this.results.delete(document.uri);
    this.emit('cleared', document);
  }
}

export default new DocumentManager();

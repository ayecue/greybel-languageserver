import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  ProposedFeatures,
  SemanticTokensBuilder
} from 'vscode-languageserver/browser';

import { FileSystem } from './fs';
import { CoreContext, DocumentManager, DocumentMerger } from 'greybel-languageserver-core';

export class BrowserContext extends CoreContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: FileSystem;
  readonly documentManager: DocumentManager;
  readonly documentMerger: DocumentMerger;

  private _messageReader: BrowserMessageReader;
  private _messageWriter: BrowserMessageWriter;

  constructor() {
    super();

    this.documentManager = new DocumentManager().setContext(this);
    this.documentMerger = new DocumentMerger();
    this._messageReader = new BrowserMessageReader(self);
    this._messageWriter = new BrowserMessageWriter(self);
    this.connection = createConnection(
      ProposedFeatures.all,
      this._messageReader,
      this._messageWriter
    );
    this.fs = new FileSystem(this);
  }

  createSemanticTokensBuilder(): SemanticTokensBuilder {
    return new SemanticTokensBuilder();
  }
}

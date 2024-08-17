import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  ProposedFeatures
} from 'vscode-languageserver/browser';

import { FileSystem } from './fs';
import { CoreContext, DocumentManager } from 'greybel-languageserver-core';

export class BrowserContext extends CoreContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: FileSystem;
  readonly documentManager: DocumentManager;

  private _messageReader: BrowserMessageReader;
  private _messageWriter: BrowserMessageWriter;

  constructor() {
    super();

    this.documentManager = new DocumentManager().setContext(this);
    this._messageReader = new BrowserMessageReader(self);
    this._messageWriter = new BrowserMessageWriter(self);
    this.connection = createConnection(
      ProposedFeatures.all,
      this._messageReader,
      this._messageWriter
    );
    this.fs = new FileSystem(this);
  }
}

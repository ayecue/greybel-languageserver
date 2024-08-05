import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  ProposedFeatures
} from 'vscode-languageserver/browser';

import { FileSystem } from './browser/fs';
import { GenericContext } from './generic';

export class BrowserContext extends GenericContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: FileSystem;

  private _messageReader: BrowserMessageReader;
  private _messageWriter: BrowserMessageWriter;

  constructor() {
    super();

    this._messageReader = new BrowserMessageReader(self);
    this._messageWriter = new BrowserMessageWriter(self);
    this.connection = createConnection(
      ProposedFeatures.all,
      this._messageReader,
      this._messageWriter
    );
    this.fs = new FileSystem();
  }
}

import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';

import { CoreContext, DocumentManager } from 'greybel-languageserver-core';
import { FileSystem } from './fs';

export class NodeContext extends CoreContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: FileSystem;
  readonly documentManager: DocumentManager;

  constructor() {
    super();

    this.documentManager = new DocumentManager().setContext(this);
    this.connection = createConnection(ProposedFeatures.all);
    this.fs = new FileSystem(this);
  }
}

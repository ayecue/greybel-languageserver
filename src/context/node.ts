import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';

import { GenericContext } from './generic';
import { FileSystem } from './node/fs';

export class NodeContext extends GenericContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: FileSystem;

  constructor() {
    super();

    this.connection = createConnection(ProposedFeatures.all);
    this.fs = new FileSystem(this);
  }
}

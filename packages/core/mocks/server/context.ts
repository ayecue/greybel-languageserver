import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';

import { CoreContext, DocumentManager, IContext } from '../../src';
import { FileSystem } from './fs';

export class NodeContext extends CoreContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: FileSystem;
  readonly documentManager: DocumentManager;

  constructor() {
    super();

    this.documentManager = new DocumentManager().setContext(this as unknown as IContext);
    this.connection = createConnection(ProposedFeatures.all);
    this.fs = new FileSystem(this as unknown as IContext);
  }
}

import {
  CoreContext,
  DocumentManager,
  DocumentMerger
} from 'greybel-languageserver-core';
import {
  createConnection,
  ProposedFeatures,
  SemanticTokensBuilder
} from 'vscode-languageserver/node';

import { FileSystem } from './fs';

export class NodeContext extends CoreContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: FileSystem;
  readonly documentManager: DocumentManager;
  readonly documentMerger: DocumentMerger;

  constructor() {
    super();

    this.documentManager = new DocumentManager().setContext(this);
    this.documentMerger = new DocumentMerger();
    this.connection = createConnection(ProposedFeatures.all);
    this.fs = new FileSystem(this);
  }

  createSemanticTokensBuilder(): SemanticTokensBuilder {
    return new SemanticTokensBuilder();
  }
}

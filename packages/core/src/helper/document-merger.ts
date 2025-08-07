import { Document as TypeDocument } from 'greybel-type-analyzer';

import {
  IActiveDocument,
  IContext,
  IDocumentMerger,
  TypeAnalyzerStrategy
} from '../types';
import { DocumentDependencyMerger } from './document-merger/document-dependency-merger';
import { DocumentMergerCache } from './document-merger/document-merger-cache';
import { DocumentWorkspaceMerger } from './document-merger/document-workspace-merger';

export class DocumentMerger implements IDocumentMerger {
  readonly cache: DocumentMergerCache;

  private dependencyMerger: DocumentDependencyMerger;
  private workspaceMerger: DocumentWorkspaceMerger;

  constructor() {
    this.cache = new DocumentMergerCache();
    this.dependencyMerger = new DocumentDependencyMerger(this.cache);
    this.workspaceMerger = new DocumentWorkspaceMerger(this.cache);
  }

  async build(
    document: IActiveDocument,
    context: IContext
  ): Promise<TypeDocument> {
    if (
      context.getConfiguration().typeAnalyzer.strategy ===
      TypeAnalyzerStrategy.Workspace
    ) {
      return this.workspaceMerger.build(document, context);
    }

    return this.dependencyMerger.build(document, context);
  }
}

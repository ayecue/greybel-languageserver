import { Document as TypeDocument } from "greybel-type-analyzer";

import { IActiveDocument, IContext, IDocumentMerger } from "../../types";
import { DocumentMergerCache } from "./document-merger-cache";
import { toposort } from "fast-toposort";
import { aggregateImportsWithNamespaceFromLocations } from "../type-manager";
import { DocumentWorkspaceBuilder, DocumentWorkspaceContext } from "../document-manager/document-workspace-builder";

export class DocumentWorkspaceMergerJob {
  private cache: DocumentMergerCache;

  constructor(cache: DocumentMergerCache) {
    this.cache = cache;
  }

  private getTypeDocument(
    documentUri: string,
    context: DocumentWorkspaceContext
  ): TypeDocument | null {
    const activeDocument = context.getRef(documentUri);

    // collect imports with namespace if possible
    if (activeDocument != null) {
      const namespacesOfImports = aggregateImportsWithNamespaceFromLocations(context.getDependencies(documentUri), context.getRefMap());

      if (namespacesOfImports.length === 0) {
        return activeDocument.typeDocument;
      }

      const mergedTypeDoc = activeDocument.typeDocument.merge(
        ...namespacesOfImports.map((it) => {
          return { document: it.typeDoc, namespaces: [{ exportFrom: 'module.exports', namespace: it.namespace }] }
        })
      );
      return mergedTypeDoc;
    }

    return activeDocument.typeDocument;
  }

  private getExternalTypeDocumentsRelatedToDocument(
    document: IActiveDocument,
    context: DocumentWorkspaceContext
  ): TypeDocument[] {
    const documentUri = document.textDocument.uri;
    const documentUris = context.documents.map((item) => item.textDocument.uri);
    // sort by it's usage
    const documentGraph: [string, string][][] = context.documents.map((item) => {
      const depUris = context.getDependencies(item.textDocument.uri);

      return depUris.map((dep) => {
        return [item.textDocument.uri, dep.location];
      });
    });
    const topoSorted = toposort(documentUris, documentGraph.flat());
    const externalTypeDocs: TypeDocument[] = new Array<TypeDocument>(
      topoSorted.length
    );

    for (let index = topoSorted.length - 1; index >= 0; index--) {
      const itemUri = topoSorted[index];
      if (itemUri === documentUri) continue;
      const itemTypeDoc = this.getTypeDocument(itemUri, context);
      if (itemTypeDoc == null) continue;
      externalTypeDocs[index] = itemTypeDoc;
    }

    const availableExternalTypeDocs = externalTypeDocs.filter(
      (item) => item != null
    );
    return availableExternalTypeDocs;
  }
  
  async process(
    document: IActiveDocument,
    context: DocumentWorkspaceContext
  ): Promise<TypeDocument> {
    const documentUri = document.textDocument.uri;
    const cacheKey = this.cache.createCacheKey(document, context.documents);

    if (this.cache.typeDocuments.has(cacheKey)) {
      return this.cache.typeDocuments.get(cacheKey);
    }

    this.cache.registerCacheKey(cacheKey, documentUri);

    await context.loadDependencies();

    const externalTypeDocs =
      this.getExternalTypeDocumentsRelatedToDocument(
        document,
        context
      );

    // collect imports with namespace
    const namespacesOfImports = aggregateImportsWithNamespaceFromLocations(
      context.getDependencies(documentUri),
      context.getRefMap()
    );

    const mergedTypeDoc = document.typeDocument.merge(
      ...namespacesOfImports.map((it) => {
        return { document: it.typeDoc, namespaces: [{ exportFrom: 'module.exports', namespace: it.namespace }] }
      }),
      ...externalTypeDocs.map((it) => {
        return { document: it };
      })
    );
    this.cache.typeDocuments.set(cacheKey, mergedTypeDoc);
    return mergedTypeDoc;
  }
}

export class DocumentWorkspaceMerger implements IDocumentMerger {
  readonly cache: DocumentMergerCache;

  private pendingJobs: Map<string, Promise<TypeDocument>>;

  constructor(cache: DocumentMergerCache) {
    this.cache = cache;
    this.pendingJobs = new Map<string, Promise<TypeDocument>>();
  }

  private async process(
    document: IActiveDocument,
    context: IContext
  ): Promise<TypeDocument> {
    const workspaceBuilder = new DocumentWorkspaceBuilder({ context });
    const workspaceContext = await workspaceBuilder.build();
    const job = new DocumentWorkspaceMergerJob(this.cache);
    return job.process(document, workspaceContext);
  }

  async build(document: IActiveDocument, context: IContext): Promise<TypeDocument> {
    const existingJob = this.pendingJobs.get(document.textDocument.uri);
    if (existingJob) {
      return existingJob;
    }
    const job = this.process(document, context);
    this.pendingJobs.set(document.textDocument.uri, job);
    const result = await job;
    this.pendingJobs.delete(document.textDocument.uri);
    return result;
  }
}
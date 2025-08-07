import { Document as TypeDocument } from "greybel-type-analyzer";

import { DependencyType, getAllDependencyLocationsFromGraph, IActiveDocument, IActiveDocumentImportGraphNode, IContext, IDocumentMerger, parseDependencyRawLocation } from "../../types";
import { DocumentMergerCache } from "./document-merger-cache";
import { DocumentGraphBuilder } from "../document-manager/document-graph-builder";
import { aggregateImportsWithNamespaceFromGraph } from "../type-manager";

export class DocumentDependencyMergerJob {
  private cache: DocumentMergerCache;
  private refs: Map<string, TypeDocument | null>;

  constructor(cache: DocumentMergerCache) {
    this.cache = cache;
    this.refs = new Map<string, TypeDocument | null>();
  }

  private mergeDocuments(node: IActiveDocumentImportGraphNode, externalTypeDocs: TypeDocument[]): TypeDocument {
    const namespacesOfImports = aggregateImportsWithNamespaceFromGraph(node, this.refs);
    const activeDocument = node.item.document;
    if (namespacesOfImports.length === 0) {
      return activeDocument.typeDocument.merge(
        ...externalTypeDocs.map((it) => {
          return { document: it };
        })
      );
    }
    return activeDocument.typeDocument.merge(
       ...namespacesOfImports.map((it) => {
        return { document: it.typeDoc, namespaces: [{ exportFrom: 'module.exports', namespace: it.namespace }] }
      }),
      ...externalTypeDocs.map((it) => {
        return { document: it };
      })
    );
  }

  process(
    node: IActiveDocumentImportGraphNode,
    context: IContext
  ): TypeDocument {
    const activeDocument = node.item.document;
    const documentUri = activeDocument.textDocument.uri;
    const existingRef = this.refs.get(documentUri);

    if (existingRef !== undefined) {
      return existingRef;
    }

    this.refs.set(documentUri, null);

    const externalTypeDocs: TypeDocument[] = [];
    const cacheKey = this.cache.createCacheKey(
      activeDocument,
      getAllDependencyLocationsFromGraph(node, new Set(activeDocument.textDocument.uri))
    );

    if (this.cache.typeDocuments.has(cacheKey)) {
      const cachedTypeDoc = this.cache.typeDocuments.get(cacheKey);
      this.refs.set(documentUri, cachedTypeDoc);
      return cachedTypeDoc;
    }

    this.cache.registerCacheKey(cacheKey, documentUri);

    if (node.children.length === 0) {
      this.refs.set(documentUri, activeDocument.typeDocument);
      this.cache.typeDocuments.set(cacheKey, activeDocument.typeDocument);
      return activeDocument.typeDocument;
    }

    for (let index = 0; index < node.children.length; index++) {
      const child = node.children[index];

      const itemTypeDoc = this.process(
        child,
        context
      );

      // Skip namespace imports to be added to externalTypeDocs, process needs to be called anyway though to ensure availability of the type document
      if (child.item.location.type === DependencyType.Import) continue;
      if (itemTypeDoc === null) return;
      externalTypeDocs.push(itemTypeDoc);
    }

    const mergedTypeDoc = this.mergeDocuments(node, externalTypeDocs);
    this.refs.set(documentUri, mergedTypeDoc);
    this.cache.typeDocuments.set(cacheKey, mergedTypeDoc);
    return mergedTypeDoc;
  }
}

export class DocumentDependencyMerger implements IDocumentMerger {
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
    const graphBuilder = new DocumentGraphBuilder({
      documentManager: context.documentManager,
      entrypoint: document
    });
    const rootNode = await graphBuilder.build();
    const job = new DocumentDependencyMergerJob(this.cache);
    return job.process(rootNode, context);
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
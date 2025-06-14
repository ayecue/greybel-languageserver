import { toposort } from 'fast-toposort';
import { LRUCache as LRU } from 'lru-cache';
import { Document as TypeDocument } from 'miniscript-type-analyzer';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
  DependencyType,
  IActiveDocument,
  IActiveDocumentImportGraphNode,
  IContext,
  IDocumentMerger,
  TypeAnalyzerStrategy
} from '../types';
import { hash } from './hash';
import typeManager, {
  aggregateImportsWithNamespace,
  createTypeDocumentWithNamespaces
} from './type-manager';

export class DocumentMerger implements IDocumentMerger {
  readonly results: LRU<number, TypeDocument>;
  private keyToDocumentUriMap: Map<string, number>;

  constructor() {
    this.keyToDocumentUriMap = new Map();
    this.results = new LRU({
      ttl: 1000 * 60 * 20,
      ttlAutopurge: true
    });
  }

  private createCacheKey(
    source: TextDocument,
    documents: IActiveDocument[]
  ): number {
    let result = hash(`main-${source.uri}-${source.version}`);

    for (let index = 0; index < documents.length; index++) {
      const doc = documents[index];
      result ^= hash(`${doc.textDocument.uri} -${doc.textDocument.version} `);
      result = result >>> 0;
    }

    return result;
  }

  private registerCacheKey(key: number, documentUri: string) {
    this.flushCacheKey(documentUri);
    this.keyToDocumentUriMap.set(documentUri, key);
  }

  flushCacheKey(documentUri: string) {
    const key = this.keyToDocumentUriMap.get(documentUri);
    if (key) {
      this.results.delete(key);
      this.keyToDocumentUriMap.delete(documentUri);
    }
  }

  flushCache() {
    this.results.clear();
  }

  private async processByDependencies(
    node: IActiveDocumentImportGraphNode,
    context: IContext,
    refs: Map<string, TypeDocument | null>
  ): Promise<TypeDocument> {
    const activeDocument = node.item.document;
    const documentUri = activeDocument.textDocument.uri;

    if (refs.has(documentUri)) {
      return refs.get(documentUri);
    }

    const typeDoc = typeManager.get(documentUri);

    refs.set(documentUri, null);

    if (!typeDoc) {
      return null;
    }

    const externalTypeDocs: TypeDocument[] = [];
    const cacheKey = this.createCacheKey(
      activeDocument.textDocument,
      node.children.map((node) => node.item.document)
    );

    if (this.results.has(cacheKey)) {
      const cachedTypeDoc = this.results.get(cacheKey);
      refs.set(documentUri, cachedTypeDoc);
      return cachedTypeDoc;
    }

    this.registerCacheKey(cacheKey, documentUri);

    await Promise.all(
      node.children.map(async (child) => {
        const itemTypeDoc = await this.processByDependencies(
          child,
          context,
          refs
        );

        if (itemTypeDoc === null) return;
        if (child.item.location.type === DependencyType.Import) return;
        externalTypeDocs.push(itemTypeDoc);
      })
    );

    const namespacesOfImports = await aggregateImportsWithNamespace(
      activeDocument,
      refs
    );

    if (namespacesOfImports.length === 0) {
      const mergedTypeDoc = typeDoc.merge(...externalTypeDocs);
      refs.set(documentUri, mergedTypeDoc);
      this.results.set(cacheKey, mergedTypeDoc);
      return mergedTypeDoc;
    }

    const mergedTypeDoc = typeDoc.merge(
      createTypeDocumentWithNamespaces(typeDoc, namespacesOfImports),
      ...externalTypeDocs
    );
    refs.set(documentUri, mergedTypeDoc);
    this.results.set(cacheKey, mergedTypeDoc);
    return mergedTypeDoc;
  }

  private async buildByDependencies(
    document: TextDocument,
    context: IContext
  ): Promise<TypeDocument> {
    const documentUri = document.uri;
    const typeDoc = typeManager.get(documentUri);

    if (!typeDoc) {
      return null;
    }

    const activeDocument = await context.documentManager.getLatest(document);
    const rootNode = await activeDocument.getImportsGraph();
    const refs: Map<string, TypeDocument | null> = new Map();

    return this.processByDependencies(rootNode, context, refs);
  }

  private async processByWorkspace(
    documentUri: string,
    context: IContext
  ): Promise<TypeDocument | null> {
    const typeDoc = typeManager.get(documentUri);
    if (typeDoc === null) return null;
    const activeDocument = context.documentManager.results.get(documentUri);

    // collect imports with namespace if possible
    if (activeDocument != null) {
      const namespacesOfImports =
        await aggregateImportsWithNamespace(activeDocument);

      if (namespacesOfImports.length === 0) {
        return typeDoc;
      }

      const mergedTypeDoc = typeDoc.merge(
        createTypeDocumentWithNamespaces(typeDoc, namespacesOfImports)
      );
      return mergedTypeDoc;
    }

    return typeDoc;
  }

  private async getExternalTypeDocumentsRelatedToDocument(
    document: TextDocument,
    allDocuments: IActiveDocument[],
    context: IContext
  ): Promise<TypeDocument[]> {
    const documentUri = document.uri;
    const documentUris = allDocuments.map((item) => item.textDocument.uri);
    // sort by it's usage
    const documentGraph: [string, string][][] = await Promise.all(
      allDocuments.map(async (item) => {
        const depUris = await item.getDependencies();

        return depUris.map((dep) => {
          return [item.textDocument.uri, dep.location];
        });
      })
    );
    const topoSorted = toposort(documentUris, documentGraph.flat());
    const externalTypeDocs: TypeDocument[] = new Array<TypeDocument>(
      topoSorted.length
    );
    const defers: Promise<void>[] = [];

    for (let index = topoSorted.length - 1; index >= 0; index--) {
      const itemUri = topoSorted[index];
      if (itemUri === documentUri) continue;
      const process = async () => {
        const itemTypeDoc = await this.processByWorkspace(itemUri, context);
        if (itemTypeDoc == null) return;
        externalTypeDocs[index] = itemTypeDoc;
      };
      defers.push(process());
    }

    await Promise.all(defers);

    const availableExternalTypeDocs = externalTypeDocs.filter(
      (item) => item != null
    );
    return availableExternalTypeDocs;
  }

  private async buildByWorkspace(
    document: TextDocument,
    context: IContext
  ): Promise<TypeDocument> {
    const documentUri = document.uri;
    const typeDoc = typeManager.get(documentUri);

    if (!typeDoc) {
      return null;
    }

    const allFileUris = await context.fs.getWorkspaceRelatedFiles();
    const allDocuments = await Promise.all(
      allFileUris.map(async (uri) => {
        const textDocument = await context.documentManager.open(uri.toString());
        return textDocument;
      })
    );
    const cacheKey = this.createCacheKey(document, allDocuments);

    if (this.results.has(cacheKey)) {
      return this.results.get(cacheKey);
    }

    this.registerCacheKey(cacheKey, documentUri);

    const externalTypeDocs =
      await this.getExternalTypeDocumentsRelatedToDocument(
        document,
        allDocuments,
        context
      );

    // collect imports with namespace
    const activeDocument = context.documentManager.get(document);
    const namespacesOfImports =
      await aggregateImportsWithNamespace(activeDocument);

    const mergedTypeDoc = typeDoc.merge(
      createTypeDocumentWithNamespaces(typeDoc, namespacesOfImports),
      ...externalTypeDocs
    );
    this.results.set(cacheKey, mergedTypeDoc);
    return mergedTypeDoc;
  }

  async build(
    document: TextDocument,
    context: IContext
  ): Promise<TypeDocument> {
    if (
      context.getConfiguration().typeAnalyzer.strategy ===
      TypeAnalyzerStrategy.Workspace
    ) {
      return this.buildByWorkspace(document, context);
    }

    return this.buildByDependencies(document, context);
  }
}

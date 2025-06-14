import { toposort } from 'fast-toposort';
import LRU from 'lru-cache';
import { SignatureDefinitionBaseType } from 'meta-utils';
import { Document as TypeDocument } from 'miniscript-type-analyzer';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
  DependencyType,
  IActiveDocument,
  IContext,
  IDocumentMerger,
  parseDependencyRawLocation,
  TypeAnalyzerStrategy
} from '../types';
import { hash } from './hash';
import typeManager, { aggregateImportsWithNamespace, createTypeDocumentWithNamespaces } from './type-manager';

type ImportWithNamespace = {
  namespace: string;
  typeDoc: TypeDocument;
};

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
    document: TextDocument,
    context: IContext,
    refs: Map<string, TypeDocument | null>
  ): Promise<TypeDocument> {
    const documentUri = document.uri;

    if (refs.has(documentUri)) {
      return refs.get(documentUri);
    }

    const typeDoc = typeManager.get(documentUri);

    refs.set(documentUri, null);

    if (!typeDoc) {
      return null;
    }

    const externalTypeDocs: TypeDocument[] = [];
    const activeDocument = await context.documentManager.getLatest(document);
    const allImports = await activeDocument.getImports();
    const cacheKey = this.createCacheKey(
      document,
      allImports.map((dep) => dep.document)
    );

    if (this.results.has(cacheKey)) {
      return this.results.get(cacheKey);
    }

    this.registerCacheKey(cacheKey, documentUri);

    const dependencies = await context.documentManager
      .get(document)
      .getDependencies();

    await Promise.all(
      dependencies.map(async (dep) => {
        const item = context.documentManager.results.get(dep.location);

        if (!item) {
          return;
        }

        const { document, textDocument } = item;

        if (!document) {
          return;
        }

        const itemTypeDoc = await this.processByDependencies(
          textDocument,
          context,
          refs
        );

        if (itemTypeDoc === null) return;
        externalTypeDocs.push(itemTypeDoc);
      })
    );

    const mergedTypeDoc = typeDoc.merge(...externalTypeDocs);
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
    const allImports = await activeDocument.getImports();
    const cacheKey = this.createCacheKey(
      document,
      allImports.map((dep) => dep.document)
    );

    if (this.results.has(cacheKey)) {
      return this.results.get(cacheKey);
    }

    const externalTypeDocs: TypeDocument[] = [];

    this.registerCacheKey(cacheKey, documentUri);

    const dependencies = await context.documentManager
      .get(document)
      .getDependencies();
    const locations = Array.from(
      new Set(dependencies.map((dep) => dep.location))
    );
    const refs: Map<string, TypeDocument | null> = new Map([
      [documentUri, null]
    ]);

    // process dependencies in parallel and extend to refs
    await Promise.all(
      locations.map(async (location) => {
        const item = context.documentManager.results.get(location);

        if (!item) {
          return;
        }

        const { document, textDocument } = item;

        if (!document) {
          return;
        }

        await this.processByDependencies(textDocument, context, refs);
      })
    );

    // collect native imports, includes and imports with namespace
    dependencies.forEach((dep) => {
      const itemTypeDoc = refs.get(dep.location);

      if (itemTypeDoc === null) return;
      if (dep.type === DependencyType.Import) return;
      externalTypeDocs.push(itemTypeDoc);
    });

    // collect imports with namespace
    const namespacesOfImports = await aggregateImportsWithNamespace(activeDocument);

    const mergedTypeDoc = typeDoc.merge(createTypeDocumentWithNamespaces(typeDoc, namespacesOfImports), ...externalTypeDocs);
    this.results.set(cacheKey, mergedTypeDoc);
    return mergedTypeDoc;
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

    const externalTypeDocs: TypeDocument[] = [];
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

    for (let index = topoSorted.length - 1; index >= 0; index--) {
      const itemUri = topoSorted[index];
      if (itemUri === documentUri) continue;
      const itemTypeDoc = typeManager.get(itemUri);

      if (itemTypeDoc === null) return;
      externalTypeDocs.push(itemTypeDoc);
    }

    // collect imports with namespace
    const activeDocument = context.documentManager.get(document);
    const namespacesOfImports = await aggregateImportsWithNamespace(activeDocument);

    const mergedTypeDoc = typeDoc.merge(createTypeDocumentWithNamespaces(typeDoc, namespacesOfImports), ...externalTypeDocs);
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

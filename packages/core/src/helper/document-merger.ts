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
import typeManager from './type-manager';

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

  private extendImportsWithNamespace(
    typeDoc: TypeDocument,
    items: ImportWithNamespace[]
  ) {
    items.forEach((item) => {
      const entity = item.typeDoc
        .getRootScopeContext()
        .scope.resolveNamespace('module', true)
        ?.resolveProperty('exports', true);

      if (entity == null) return;

      const rootScope = typeDoc.getRootScopeContext().scope;
      const existingNamespace = rootScope.resolveProperty(item.namespace);

      if (existingNamespace) {
        existingNamespace.types.delete(SignatureDefinitionBaseType.Any);
        existingNamespace.extend(entity, true);
        return;
      }

      rootScope.setProperty(item.namespace, entity, true);
    });
  }

  private async aggregateImportsWithNamespace(
    activeDocument: IActiveDocument
  ): Promise<ImportWithNamespace[]> {
    const result: ImportWithNamespace[] = [];

    if (activeDocument == null) {
      return result;
    }

    const importUris = await activeDocument.getImportUris();

    importUris.forEach((rawLocation) => {
      const importDef = parseDependencyRawLocation(rawLocation);
      const namespace = importDef.args[0];
      if (namespace == null) return;
      const itemTypeDoc = typeManager.get(importDef.location);
      if (itemTypeDoc === null) return;
      result.push({
        namespace,
        typeDoc: itemTypeDoc
      });
    });

    return result;
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
    const importsWithNamespace: ImportWithNamespace[] = [];

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
      if (dep.type === DependencyType.Import) {
        const namespace = dep.args[0];
        if (namespace == null) return;
        importsWithNamespace.push({
          namespace,
          typeDoc: itemTypeDoc
        });
        return;
      }
      externalTypeDocs.push(itemTypeDoc);
    });

    const mergedTypeDoc = typeDoc.merge(...externalTypeDocs);

    // extend imports with namespace
    this.extendImportsWithNamespace(mergedTypeDoc, importsWithNamespace);

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
    const importsWithNamespace: ImportWithNamespace[] =
      await this.aggregateImportsWithNamespace(activeDocument);

    const mergedTypeDoc = typeDoc.merge(...externalTypeDocs);

    // extend imports with namespace
    this.extendImportsWithNamespace(mergedTypeDoc, importsWithNamespace);

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

import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  Document as TypeDocument
} from 'miniscript-type-analyzer';
import LRU from 'lru-cache';

import { IActiveDocument, IContext, IDocumentMerger } from '../types';
import typeManager from './type-manager';
import { hash } from './hash';

export class DocumentMerger implements IDocumentMerger {
  readonly results: LRU<number, TypeDocument>;

  constructor() {
    this.results = new LRU({
      ttl: 1000 * 60 * 20,
      ttlAutopurge: true
    });
  }

  private createCacheKey(source: TextDocument, documents: IActiveDocument[]): number {
    let result = hash(`${source.uri}-${source.version}`);

    for (let index = 0; index < documents.length; index++) {
      const document = documents[index];
      result ^= hash(`${document.textDocument.uri}-${document.textDocument.version}`);
      result = result >>> 0;
    }

    return result;
  }

  private async process(
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
    const allImports = await context.documentManager.get(document).getImports();

    await Promise.all(
      allImports.map(async (item) => {
        const { document, textDocument } = item;

        if (!document) {
          return;
        }

        const itemTypeDoc = await this.process(textDocument, context, refs);

        if (itemTypeDoc === null) return;
        externalTypeDocs.push(itemTypeDoc);
      })
    );

    const mergedTypeDoc = typeDoc.merge(...externalTypeDocs);
    refs.set(documentUri, mergedTypeDoc);
    return mergedTypeDoc;
  }

  async build(
    document: TextDocument,
    context: IContext
  ): Promise<TypeDocument> {
    const documentUri = document.uri;
    const typeDoc = typeManager.get(documentUri);

    if (!typeDoc) {
      return null;
    }

    const externalTypeDocs: TypeDocument[] = [];
    const allImports = await context.documentManager.get(document).getImports();
    const cacheKey = this.createCacheKey(document, allImports);

    if (this.results.has(cacheKey)) {
      return this.results.get(cacheKey);
    }

    const refs: Map<string, TypeDocument | null> = new Map();

    await Promise.all(
      allImports.map(async (item) => {
        const { document, textDocument } = item;

        if (!document) {
          return;
        }

        const itemTypeDoc = await this.process(textDocument, context, refs);

        if (itemTypeDoc === null) return;
        externalTypeDocs.push(itemTypeDoc);
      })
    );

    const mergedTypeDoc = typeDoc.merge(...externalTypeDocs);
    this.results.set(cacheKey, mergedTypeDoc);
    return mergedTypeDoc;
  }
}
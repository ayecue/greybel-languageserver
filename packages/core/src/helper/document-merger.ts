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

  private createCacheKey(documents: IActiveDocument[]): number {
    let result = 0;

    for (const document of documents) {
      result ^= hash(`${document.textDocument}-${document.textDocument.version}`);
    }

    return result;
  }

  async build(
    document: TextDocument,
    context: IContext,
    refs: Map<string, TypeDocument | null> = new Map()
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

    const externalTypeDocs = [];
    const allImports = await context.documentManager.get(document).getImports();
    const cacheKey = this.createCacheKey(allImports);

    if (this.results.has(cacheKey)) {
      return this.results.get(cacheKey);
    }

    await Promise.all(
      allImports.map(async (item) => {
        const { document, textDocument } = item;

        if (!document) {
          return;
        }

        const itemTypeDoc = await this.build(textDocument, context, refs);

        if (itemTypeDoc === null) return;
        externalTypeDocs.push(itemTypeDoc);
      })
    );

    const mergedTypeDoc = typeDoc.merge(...externalTypeDocs);
    refs.set(documentUri, mergedTypeDoc);
    this.results.set(cacheKey, mergedTypeDoc);
    return mergedTypeDoc;
  }
}
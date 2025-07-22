import { LRUCache as LRU } from 'lru-cache';
import { Document as TypeDocument } from 'miniscript-type-analyzer';

import { IActiveDocument } from '../../types';
import { hash } from '../hash';

export class DocumentMergerCache {
  readonly typeDocuments: LRU<number, TypeDocument>;
  private keyToDocumentUriMap: Map<string, number>;

  constructor() {
    this.typeDocuments = new LRU<number, TypeDocument>({
      max: 100,
      ttl: 1000 * 60 * 5 // 5 minutes
    });
    this.keyToDocumentUriMap = new Map<string, number>();
  }

  createCacheKey(
    source: IActiveDocument,
    documents: IActiveDocument[]
  ): number {
    let result = hash(
      `main-${source.textDocument.uri}-${source.textDocument.version}`
    );

    for (let index = 0; index < documents.length; index++) {
      const doc = documents[index];
      result ^= hash(`${doc.textDocument.uri}-${doc.textDocument.version}`);
      result = result >>> 0;
    }

    return result;
  }

  registerCacheKey(key: number, documentUri: string) {
    this.flushCacheKey(documentUri);
    this.keyToDocumentUriMap.set(documentUri, key);
  }

  flushCacheKey(documentUri: string) {
    const key = this.keyToDocumentUriMap.get(documentUri);
    if (key) {
      this.typeDocuments.delete(key);
      this.keyToDocumentUriMap.delete(documentUri);
    }
  }

  flushCache() {
    this.typeDocuments.clear();
  }
}
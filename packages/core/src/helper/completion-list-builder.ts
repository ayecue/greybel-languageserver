import { IEntity } from 'miniscript-type-analyzer';
import type { CompletionItem } from 'vscode-languageserver';

import { getCompletionItemKind } from './kind';

export class CompletionListBuilder {
  private default: CompletionItem[];
  private collection: ReturnType<IEntity['getAllIdentifier']>;

  constructor() {
    this.collection = new Map();
    this.default = [];
  }

  setDefault(items: CompletionItem[]) {
    this.default = items;
  }

  addCollection(collection: ReturnType<IEntity['getAllIdentifier']> | null) {
    if (collection == null) return;
    this.collection = new Map([...this.collection, ...collection]);
  }

  build(): CompletionItem[] {
    const items: CompletionItem[] = [];

    for (const [property, item] of this.collection) {
      items.push({
        label: property,
        kind: getCompletionItemKind(item.kind)
      });
    }

    return [...items, ...this.default];
  }
}

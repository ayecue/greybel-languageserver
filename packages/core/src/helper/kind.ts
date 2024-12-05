import { CompletionItemKind as EntityCompletionItemKind } from 'miniscript-type-analyzer';
import type { CompletionItemKind, SymbolKind } from 'vscode-languageserver';

const CompletionItemKindMapping: Record<
  EntityCompletionItemKind,
  CompletionItemKind
> = {
  [EntityCompletionItemKind.Constant]: 21, // CompletionItemKind.Constant
  [EntityCompletionItemKind.Internal]: 21, // CompletionItemKind.Constant
  [EntityCompletionItemKind.InternalFunction]: 21, // CompletionItemKind.Constant
  [EntityCompletionItemKind.InternalProperty]: 21, // CompletionItemKind.Constant
  [EntityCompletionItemKind.Property]: 6, // CompletionItemKind.Property
  [EntityCompletionItemKind.Variable]: 6, // CompletionItemKind.Variable
  [EntityCompletionItemKind.Expression]: 6, // CompletionItemKind.Variable
  [EntityCompletionItemKind.Function]: 3, // CompletionItemKind.Function
  [EntityCompletionItemKind.ListConstructor]: 12, // CompletionItemKind.Value
  [EntityCompletionItemKind.MapConstructor]: 12, // CompletionItemKind.Value
  [EntityCompletionItemKind.Literal]: 12, // CompletionItemKind.Value
  [EntityCompletionItemKind.Unknown]: 12 // CompletionItemKind.Value
};

export const getCompletionItemKind = (
  kind: EntityCompletionItemKind
): CompletionItemKind => {
  return CompletionItemKindMapping[kind] ?? 6; // CompletionItemKind.Variable
};

const SymbolItemKindMapping: Record<EntityCompletionItemKind, SymbolKind> = {
  [EntityCompletionItemKind.Constant]: 14, // SymbolKind.Constant
  [EntityCompletionItemKind.Internal]: 14, // SymbolKind.Constant
  [EntityCompletionItemKind.InternalFunction]: 14, // SymbolKind.Constant
  [EntityCompletionItemKind.InternalProperty]: 14, // SymbolKind.Constant
  [EntityCompletionItemKind.Variable]: 13, // SymbolKind.Variable
  [EntityCompletionItemKind.Property]: 13, // SymbolKind.Variable
  [EntityCompletionItemKind.Expression]: 13, // SymbolKind.Variable
  [EntityCompletionItemKind.Function]: 12, // SymbolKind.Function
  [EntityCompletionItemKind.ListConstructor]: 18, // SymbolKind.Array
  [EntityCompletionItemKind.MapConstructor]: 19, // SymbolKind.Object
  [EntityCompletionItemKind.Literal]: 13, // SymbolKind.Variable
  [EntityCompletionItemKind.Unknown]: 13 // SymbolKind.Variable
};

export const getSymbolItemKind = (
  kind: EntityCompletionItemKind
): SymbolKind => {
  return SymbolItemKindMapping[kind] ?? 13; // SymbolKind.Variable
};

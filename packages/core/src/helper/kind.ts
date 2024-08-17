import { CompletionItemKind as EntityCompletionItemKind } from 'miniscript-type-analyzer';
import type { CompletionItemKind, SymbolKind } from 'vscode-languageserver';

export const getCompletionItemKind = (
  kind: EntityCompletionItemKind
): CompletionItemKind => {
  switch (kind) {
    case EntityCompletionItemKind.Constant:
      return 21; // CompletionItemKind.Constant
    case EntityCompletionItemKind.Variable:
      return 6; // CompletionItemKind.Variable
    case EntityCompletionItemKind.Expression:
      return 6; // CompletionItemKind.Variable
    case EntityCompletionItemKind.Function:
      return 3; // CompletionItemKind.Function
    case EntityCompletionItemKind.ListConstructor:
    case EntityCompletionItemKind.MapConstructor:
    case EntityCompletionItemKind.Literal:
    case EntityCompletionItemKind.Unknown:
      return 12; // CompletionItemKind.Value
  }
};

export const getSymbolItemKind = (
  kind: EntityCompletionItemKind
): SymbolKind => {
  switch (kind) {
    case EntityCompletionItemKind.Constant:
      return 14; // SymbolKind.Constant
    case EntityCompletionItemKind.Variable:
      return 13; // SymbolKind.Variable
    case EntityCompletionItemKind.Expression:
      return 13; // SymbolKind.Variable
    case EntityCompletionItemKind.Function:
      return 12; // SymbolKind.Function
    case EntityCompletionItemKind.ListConstructor:
      return 18; // SymbolKind.Array
    case EntityCompletionItemKind.MapConstructor:
      return 19; // SymbolKind.Object
    case EntityCompletionItemKind.Literal:
    case EntityCompletionItemKind.Unknown:
      return 13; // SymbolKind.Variable
  }
};

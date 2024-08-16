import type { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

export const AVAILABLE_CONSTANTS: CompletionItem[] = [
  'true',
  'false',
  'null',
  'params',
  'globals',
  'locals',
  'outer'
].map((item: string) => {
  return {
    label: item,
    kind: 21 // CompletionItemKind.Constant
  };
});

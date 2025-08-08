import type { CompletionItem } from 'vscode-languageserver';

export const AVAILABLE_CONSTANTS: CompletionItem[] = [
  'true',
  'false',
  'null'
].map((item: string) => {
  return {
    label: item,
    kind: 21 // CompletionItemKind.Constant
  };
});

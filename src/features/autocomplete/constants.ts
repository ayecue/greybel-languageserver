import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';

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
    kind: CompletionItemKind.Constant
  };
});

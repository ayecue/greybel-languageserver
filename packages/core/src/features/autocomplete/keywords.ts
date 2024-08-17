import type { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { GreybelKeyword } from 'greybel-core';
import { GreyScriptKeyword } from 'greyscript-core';
import { Keyword as CoreKeyword } from 'miniscript-core';

export const AVAILABLE_KEYWORDS: CompletionItem[] = [
  CoreKeyword.If,
  CoreKeyword.In,
  CoreKeyword.Or,
  CoreKeyword.And,
  CoreKeyword.Isa,
  CoreKeyword.For,
  CoreKeyword.New,
  CoreKeyword.Not,
  CoreKeyword.End,
  CoreKeyword.Then,
  CoreKeyword.Else,
  CoreKeyword.Break,
  CoreKeyword.While,
  CoreKeyword.Return,
  CoreKeyword.Function,
  CoreKeyword.Continue,
  GreyScriptKeyword.ImportCode,
  GreybelKeyword.Envar,
  GreybelKeyword.Import,
  GreybelKeyword.Include,
  GreybelKeyword.Debugger,
  GreybelKeyword.Line,
  GreybelKeyword.File
].map((item: string) => {
  return {
    label: item,
    kind: 14 // CompletionItemKind.Keyword
  };
});

import { TextDocument } from 'vscode-languageserver-textdocument';

import { IContext, LanguageId } from '../types';

export function activate(context: IContext) {
  const update = (document: TextDocument) => {
    if (document.languageId !== LanguageId) {
      return false;
    }

    return context.documentManager.schedule(document);
  };
  const clear = (document: TextDocument) => {
    if (document.languageId !== LanguageId) {
      return;
    }

    context.documentManager.clear(document);
  };

  context.fs.on('text-document-open', update);
  context.fs.on('text-document-change', update);
  context.fs.on('text-document-close', clear);
}

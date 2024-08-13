import { TextDocument } from 'vscode-languageserver-textdocument';

import documentManager from '../helper/document-manager';
import { IContext, LanguageId } from '../types';

export function activate(context: IContext) {
  const update = (document: TextDocument) => {
    if (document.languageId !== LanguageId) {
      return false;
    }

    return documentManager.schedule(document);
  };
  const clear = (document: TextDocument) => {
    if (document.languageId !== LanguageId) {
      return;
    }

    documentManager.clear(document);
  };

  context.fs.on('text-document-open', update);
  context.fs.on('text-document-change', update);
  context.fs.on('text-document-close', clear);
}

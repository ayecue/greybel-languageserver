import { TextDocument } from 'vscode-languageserver-textdocument';

import documentManager from '../helper/document-manager';
import { IContext } from '../types';

export function activate(context: IContext) {
  const update = (document: TextDocument) => {
    if (document.languageId !== 'greyscript') {
      return false;
    }

    return documentManager.update(document);
  };
  const clear = (document: TextDocument) => {
    if (document.languageId !== 'greyscript') {
      return;
    }

    documentManager.clear(document);
  };

  context.fs.on('textDocument-open', update);
  context.fs.on('textDocument-change', update);
  context.fs.on('textDocument-close', clear);
}

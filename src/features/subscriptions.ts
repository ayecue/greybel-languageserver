import { TextDocument } from 'vscode-languageserver-textdocument';

import ctx from '../context';
import documentManager from '../helper/document-manager';

export function activate() {
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

  ctx.on('textDocument-open', update);
  ctx.on('textDocument-change', update);
  ctx.on('textDocument-close', clear);
}

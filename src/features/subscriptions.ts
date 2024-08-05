import {
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  TextDocumentChangeEvent
} from 'vscode-languageserver/node';
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

  ctx.textDocumentManager.onDidOpen(
    (event: TextDocumentChangeEvent<TextDocument>) => {
      update(event.document);
    }
  );

  ctx.textDocumentManager.onDidChangeContent(
    (event: TextDocumentChangeEvent<TextDocument>) => {
      update(event.document);
    }
  );

  ctx.textDocumentManager.onDidClose(
    (event: TextDocumentChangeEvent<TextDocument>) => {
      clear(event.document);
    }
  );
}

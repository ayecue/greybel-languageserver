import {
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams
} from 'vscode-languageserver';
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

  ctx.connection.onDidOpenTextDocument((params: DidOpenTextDocumentParams) => {
    const document = ctx.textDocumentManager.get(params.textDocument.uri);
    update(document);
  });

  ctx.connection.onDidChangeTextDocument(
    (params: DidChangeTextDocumentParams) => {
      const document = ctx.textDocumentManager.get(params.textDocument.uri);
      update(document);
    }
  );

  ctx.connection.onDidCloseTextDocument(
    (params: DidCloseTextDocumentParams) => {
      const document = ctx.textDocumentManager.get(params.textDocument.uri);
      clear(document);
    }
  );
}

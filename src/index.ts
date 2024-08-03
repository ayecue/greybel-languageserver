import {
  createConnection,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { activate as activateAutocomplete } from './features/autocomplete';
import context from './helper/context';

context.connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;
  const result: InitializeResult = {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    capabilities: {
      completionProvider: {
        resolveProvider: true
      }
    }
  };

  return result;
});

activateAutocomplete(context);

context.listen();
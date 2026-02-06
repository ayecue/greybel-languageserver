import { SymbolInfo } from 'greybel-type-analyzer';
import type {
  DocumentSymbolParams,
  SymbolInformation,
  WorkspaceSymbolParams
} from 'vscode-languageserver';

import { getSymbolItemKind } from '../helper/kind';
import { IActiveDocument, IContext } from '../types';

const handleItem = (
  document: IActiveDocument,
  item: SymbolInfo
): SymbolInformation[] => {
  if (item.source == null) {
    return [];
  }

  console.log('handleItem', item.name, item.kind, item.source.length);

  const kind = item.kind ? getSymbolItemKind(item.kind) : 13; // SymbolKind.Variable
  const result: SymbolInformation[] = [];

  for (const source of item.source) {
    if (item.name == "") {
      continue;
    }

    const start = {
      line: source.start.line - 1,
      character: source.start.character - 1
    };
    const end = {
      line: source.end.line - 1,
      character: source.end.character - 1
    };

    result.push(
      {
        name: item.name,
        kind,
        location: {
          uri: document.textDocument.uri,
          range: { start, end }
        }
      }
    );
  }

  return result;
};

const findAllAssignments = (
  document: IActiveDocument,
  query: string
): SymbolInformation[] => {
  const typeDoc = document.typeDocument;
  const defs = typeDoc.resolveAllAssignmentsWithQuery(query);
  const result: SymbolInformation[] = [];

  for (const defItem of defs) {
    result.push(...handleItem(document, defItem));
  }

  return result;
};

export function activate(context: IContext) {
  context.connection.onDocumentSymbol(async (params: DocumentSymbolParams) => {
    const document = await context.fs.getTextDocument(params.textDocument.uri);

    if (document == null) {
      return;
    }

    const parseResult = context.documentManager.get(document);

    if (!parseResult.parsedPayload) {
      return;
    }

    return findAllAssignments(parseResult, '');
  });

  context.connection.onWorkspaceSymbol((params: WorkspaceSymbolParams) => {
    const result: SymbolInformation[] = [];

    for (const document of context.fs.getAllTextDocuments()) {
      const parseResult = context.documentManager.get(document);

      if (!parseResult.parsedPayload) {
        continue;
      }

      result.push(...findAllAssignments(parseResult, params.query));
    }

    return result;
  });
}

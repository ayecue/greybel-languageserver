import {
  ASTAssignmentStatement,
  ASTForGenericStatement,
  ASTType
} from 'miniscript-core';
import {
  ASTDefinitionItem,
  createExpressionId
} from 'miniscript-type-analyzer';
import type {
  DocumentSymbolParams,
  SymbolInformation,
  WorkspaceSymbolParams
} from 'vscode-languageserver';

import { getSymbolItemKind } from '../helper/kind';
import { IActiveDocument, IContext } from '../types';

const handleItem = (
  document: IActiveDocument,
  item: ASTAssignmentStatement | ASTForGenericStatement
): SymbolInformation | null => {
  const entity = document.typeDocument.resolveNamespace(item.variable, true);

  if (entity == null) {
    return null;
  }

  const label = createExpressionId(item.variable);
  const kind = entity?.kind ? getSymbolItemKind(entity.kind) : 13; // SymbolKind.Variable

  const start = {
    line: item.variable.start.line - 1,
    character: item.variable.start.character - 1
  };
  const end = {
    line: item.variable.end.line - 1,
    character: item.variable.end.character - 1
  };

  return {
    name: label,
    kind,
    location: {
      uri: document.textDocument.uri,
      range: { start, end }
    }
  };
};

const handleDefinitionItem = (
  document: IActiveDocument,
  item: ASTDefinitionItem
): SymbolInformation | null => {
  switch (item.node.type) {
    case ASTType.AssignmentStatement:
      return handleItem(document, item.node as ASTAssignmentStatement);
    case ASTType.ForGenericStatement:
      return handleItem(document, item.node as ASTForGenericStatement);
    default:
      return null;
  }
};

const findAllAssignments = (
  document: IActiveDocument,
  query: string
): SymbolInformation[] => {
  const typeDoc = document.typeDocument;
  const defs = typeDoc.resolveAllAssignmentsWithQuery(query);
  const result: SymbolInformation[] = [];

  for (const defItem of defs) {
    const symbol = handleDefinitionItem(document, defItem);

    if (symbol != null) {
      result.push(symbol);
    }
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

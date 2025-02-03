import {
  ASTAssignmentStatement,
  ASTForGenericStatement,
  ASTType
} from 'miniscript-core';
import {
  ASTDefinitionItem,
  createExpressionId,
  Document as MSDocument
} from 'miniscript-type-analyzer';
import type {
  DocumentSymbolParams,
  SymbolInformation,
  WorkspaceSymbolParams
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { getSymbolItemKind } from '../helper/kind';
import typeManager from '../helper/type-manager';
import { IContext } from '../types';

const handleItem = (
  document: TextDocument,
  typeDoc: MSDocument,
  item: ASTAssignmentStatement | ASTForGenericStatement
): SymbolInformation | null => {
  const entity = typeDoc.resolveNamespace(item.variable, true);

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
      uri: document.uri,
      range: { start, end }
    }
  };
};

const handleDefinitionItem = (
  document: TextDocument,
  typeDoc: MSDocument,
  item: ASTDefinitionItem
): SymbolInformation | null => {
  switch (item.node.type) {
    case ASTType.AssignmentStatement:
      return handleItem(document, typeDoc, item.node as ASTAssignmentStatement);
    case ASTType.ForGenericStatement:
      return handleItem(document, typeDoc, item.node as ASTForGenericStatement);
    default:
      return null;
  }
};

const findAllAssignments = (
  document: TextDocument,
  query: string
): SymbolInformation[] => {
  const typeDoc = typeManager.get(document.uri);
  const defs = typeDoc.resolveAllAssignmentsWithQuery(query);
  const result: SymbolInformation[] = [];

  for (const defItem of defs) {
    const symbol = handleDefinitionItem(document, typeDoc, defItem);

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

    const parseResult = await context.documentManager.getLatest(document);

    if (!parseResult.document) {
      return;
    }

    return findAllAssignments(document, '');
  });

  context.connection.onWorkspaceSymbol((params: WorkspaceSymbolParams) => {
    const result: SymbolInformation[] = [];

    for (const document of context.fs.getAllTextDocuments()) {
      const parseResult = context.documentManager.get(document);

      if (!parseResult.document) {
        continue;
      }

      result.push(...findAllAssignments(document, params.query));
    }

    return result;
  });
}

import { ASTAssignmentStatement } from 'miniscript-core';
import { createExpressionId } from 'miniscript-type-analyzer';
import type {
  DocumentSymbolParams,
  SymbolInformation,
  WorkspaceSymbolParams
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import documentManager from '../helper/document-manager';
import { getSymbolItemKind } from '../helper/kind';
import typeManager from '../helper/type-manager';
import { IContext } from '../types';

const findAllAssignments = (
  document: TextDocument,
  query: string
): SymbolInformation[] => {
  const typeDoc = typeManager.get(document.uri);
  const assignments = typeDoc.resolveAllAssignmentsWithQuery(query);
  const result: SymbolInformation[] = [];

  for (const assignmentItem of assignments) {
    const assignment = assignmentItem as ASTAssignmentStatement;
    const entity = typeDoc.resolveNamespace(assignment.variable, true);
    const label = entity?.label ?? createExpressionId(assignmentItem.variable);
    const kind = entity?.kind ? getSymbolItemKind(entity.kind) : 13; // SymbolKind.Variable

    const start = {
      line: assignment.variable.start.line - 1,
      character: assignment.variable.start.character - 1
    };
    const end = {
      line: assignment.variable.end.line - 1,
      character: assignment.variable.end.character - 1
    };

    result.push({
      name: label,
      containerName: label,
      kind,
      location: {
        uri: document.uri,
        range: { start, end }
      }
    });
  }

  return result;
};

export function activate(context: IContext) {
  context.connection.onDocumentSymbol(async (params: DocumentSymbolParams) => {
    const document = await context.fs.getTextDocument(params.textDocument.uri);
    const parseResult = documentManager.get(document);

    if (!parseResult.document) {
      return [];
    }

    return findAllAssignments(document, '');
  });

  context.connection.onWorkspaceSymbol((params: WorkspaceSymbolParams) => {
    const result: SymbolInformation[] = [];

    for (const document of context.fs.getAllTextDocuments()) {
      const parseResult = documentManager.get(document);

      if (!parseResult.document) {
        continue;
      }

      result.push(...findAllAssignments(document, params.query));
    }

    return result;
  });
}

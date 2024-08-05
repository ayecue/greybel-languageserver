import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTMemberExpression
} from 'miniscript-core';
import {
  DefinitionLink,
  DefinitionParams,
  Position
} from 'vscode-languageserver/node';

import ctx from '../context';
import documentManager from '../helper/document-manager';
import { LookupHelper } from '../helper/lookup-type';

const findAllDefinitions = (
  helper: LookupHelper,
  item: ASTBase,
  root: ASTBaseBlockWithScope
): DefinitionLink[] => {
  const assignments = helper.findAllAssignmentsOfItem(item, root);
  const definitions: DefinitionLink[] = [];

  for (const assignment of assignments) {
    if (!assignment.start || !assignment.end) {
      continue;
    }

    const start: Position = {
      line: assignment.start.line - 1,
      character: assignment.start.character - 1
    };
    const end: Position = {
      line: assignment.end.line - 1,
      character: assignment.end.character - 1
    };
    const definitionLink: DefinitionLink = {
      targetUri: helper.document.uri,
      targetRange: { start, end },
      targetSelectionRange: { start, end }
    };

    definitions.push(definitionLink);
  }

  return definitions;
};

export function activate() {
  ctx.connection.onDefinition(async (params: DefinitionParams) => {
    const document = await ctx.getTextDocument(params.textDocument.uri);
    const helper = new LookupHelper(document);
    const astResult = helper.lookupAST(params.position);

    if (!astResult) {
      return [];
    }

    const { outer, closest } = astResult;

    const previous = outer.length > 0 ? outer[outer.length - 1] : undefined;
    let target: ASTBase = closest;

    if (previous) {
      if (
        previous instanceof ASTMemberExpression &&
        previous.identifier === closest
      ) {
        target = previous;
      }
    }

    const definitions = findAllDefinitions(helper, target, target.scope!);
    const allImports = await documentManager.get(document).getImports();

    for (const item of allImports) {
      const { document, textDocument } = item;

      if (!document) {
        continue;
      }

      const helper = new LookupHelper(textDocument);
      const subDefinitions = findAllDefinitions(helper, target, document);

      definitions.push(...subDefinitions);
    }

    return definitions;
  });
}

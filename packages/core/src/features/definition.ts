import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTMemberExpression
} from 'miniscript-core';
import type {
  DefinitionParams,
  Location,
  Position
} from 'vscode-languageserver';

import { LookupHelper } from '../helper/lookup-type';
import { IContext } from '../types';

const definitionLinkToString = (link: Location): string => {
  return `${link.uri}:${link.range.start.line}:${link.range.start.character}-${link.range.end.line}:${link.range.end.character}`;
};

const findAllDefinitions = async (
  helper: LookupHelper,
  item: ASTBase,
  root: ASTBaseBlockWithScope
): Promise<Location[]> => {
  const assignments = await helper.findAllAssignmentsOfItem(item, root);
  const definitions: Location[] = [];
  const visited = new Set<string>();

  for (const assignment of assignments) {
    const node = assignment.node;

    if (!node.start || !node.end) {
      continue;
    }

    const start: Position = {
      line: node.start.line - 1,
      character: node.start.character - 1
    };
    const end: Position = {
      line: node.end.line - 1,
      character: node.end.character - 1
    };
    const definitionLink: Location = {
      uri: assignment.source,
      range: { start, end }
    };
    const linkString = definitionLinkToString(definitionLink);

    if (visited.has(linkString)) {
      continue;
    }

    visited.add(linkString);
    definitions.push(definitionLink);
  }

  return definitions;
};

export function activate(context: IContext) {
  context.connection.onDefinition(async (params: DefinitionParams) => {
    const document = await context.fs.getTextDocument(params.textDocument.uri);

    if (document == null) {
      return;
    }

    const helper = new LookupHelper(document, context);
    const astResult = helper.lookupAST(params.position);

    if (!astResult) {
      return;
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

    return await findAllDefinitions(helper, target, target.scope!);
  });
}

import { TypeSource } from 'greybel-type-analyzer';
import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTForGenericStatement,
  ASTMemberExpression,
  ASTType
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

const getLocation = (item: TypeSource): Location => {
  const node = item.astRef;
  let start: Position;
  let end: Position;

  switch (node.type) {
    case ASTType.ForGenericStatement: {
      const stmt = node as ASTForGenericStatement;
      start = {
        line: stmt.variable.start.line - 1,
        character: stmt.variable.start.character - 1
      };
      end = {
        line: stmt.variable.end.line - 1,
        character: stmt.variable.end.character - 1
      };
      break;
    }
    default: {
      start = {
        line: node.start.line - 1,
        character: node.start.character - 1
      };
      end = {
        line: node.end.line - 1,
        character: node.end.character - 1
      };
    }
  }

  return {
    uri: item.document,
    range: { start, end }
  };
};

const findAllDefinitions = async (
  helper: LookupHelper,
  item: ASTBase
): Promise<Location[]> => {
  const result = await helper.findAllAssignmentsOfItem(item);
  const sources = result?.getSource();

  if (sources == null || sources.length === 0) {
    return [];
  }

  const definitions: Location[] = [];
  const visited = new Set<string>();

  for (const source of sources) {
    const node = source.astRef;

    if (node == null) {
      continue;
    }

    if (!node.start || !node.end) {
      continue;
    }

    const definitionLink: Location = getLocation(source);
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

    const activeDocument = await context.documentManager.getLatest(document);
    const helper = new LookupHelper(activeDocument, context);
    const astResult = await helper.lookupAST(params.position);

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

    return await findAllDefinitions(helper, target);
  });
}

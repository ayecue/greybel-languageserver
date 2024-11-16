import {
  ASTAssignmentStatement,
  ASTBase,
  ASTMemberExpression,
  ASTType
} from 'miniscript-core';
import { createExpressionId } from 'miniscript-type-analyzer';
import type { Location, Position } from 'vscode-languageserver';

import { IActiveDocument } from '../types';
import { ScraperWalker } from './ast-scraper';

const createLocation = (item: ASTBase, location: string): Location => {
  const start: Position = {
    line: item.start.line - 1,
    character: item.start.character - 1
  };
  const end: Position = {
    line: item.end.line - 1,
    character: item.end.character - 1
  };

  return {
    uri: location,
    range: { start, end }
  };
};

const findAllMembers = (item: ASTMemberExpression): ASTMemberExpression[] => {
  const members: ASTMemberExpression[] = [];
  let current = item;
  while (current.type === ASTType.MemberExpression) {
    members.push(current);
    current = current.base as ASTMemberExpression;
  }
  members.push(current);
  return members;
};

export const findDocumentReferences = (
  document: IActiveDocument,
  target: ASTBase,
  includeDeclaration: boolean = false
): Location[] => {
  const references: Location[] = [];

  if (
    target.type !== ASTType.Identifier &&
    target.type !== ASTType.MemberExpression
  ) {
    return references;
  }

  const id = createExpressionId(target);
  const walkerMap = includeDeclaration
    ? null
    : {
        AssignmentStatement: function (
          item: ASTAssignmentStatement,
          level: number
        ) {
          walker.visit(item.init, level);
        }
      };

  const walker = new ScraperWalker((item: ASTBase) => {
    switch (item.type) {
      case ASTType.Identifier: {
        if (target.type !== item.type) return null;
        const itemId = createExpressionId(item);
        if (itemId === id) {
          references.push(createLocation(item, document.textDocument.uri));
        }
        return null;
      }
      case ASTType.MemberExpression: {
        if (target.type !== item.type) return null;
        const members = findAllMembers(item as ASTMemberExpression);

        for (let index = 0; index < members.length; index++) {
          const member = members[index];
          const memberId = createExpressionId(member);
          if (memberId === id) {
            references.push(
              createLocation(
                (member as ASTMemberExpression).identifier,
                document.textDocument.uri
              )
            );
          }
        }

        return {
          skip: true
        };
      }
    }

    return null;
  }, walkerMap);

  walker.visit(document.document);

  return references;
};

export const findAllReferences = async (
  document: IActiveDocument,
  target: ASTBase,
  includeDeclaration: boolean = false
): Promise<Location[]> => {
  let references: Location[] = [];

  if (
    target.type !== ASTType.Identifier &&
    target.type !== ASTType.MemberExpression
  ) {
    return references;
  }

  const imports = await document.getImports();
  const documents = [document, ...imports];

  for (let index = 0; index < documents.length; index++) {
    const doc = documents[index];
    references = references.concat(
      findDocumentReferences(doc, target, includeDeclaration)
    );
  }

  return references;
};

import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope,
  ASTCallExpression,
  ASTCallStatement,
  ASTIndexExpression,
  ASTMemberExpression,
  ASTSliceExpression,
  ASTType
} from 'miniscript-core';
import { ScraperWalker } from './ast-scraper';
import { createExpressionId } from 'miniscript-type-analyzer';

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
  root: ASTBaseBlockWithScope,
  target: ASTBase,
  includeDeclaration: boolean = false
): ASTBase[] => {
  const references: ASTBase[] = [];

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
          references.push(item);
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
            references.push((member as ASTMemberExpression).identifier);
          }
        }

        return {
          skip: true
        };
      }
    }

    return null;
  }, walkerMap);

  walker.visit(root);

  return references;
};

export const lookupRootScope = (origin: ASTBaseBlockWithScope): ASTBaseBlockWithScope => {
  let current = origin;
  while (current.scope) {
    current = current.scope;
  }
  return current;
}

export const lookupScopes = (origin: ASTBaseBlockWithScope): ASTBaseBlockWithScope[] => {
  if (!origin.scope) return [origin];

  const rootScope = lookupRootScope(origin);

  if (rootScope === origin.scope) return [origin, rootScope];

  return [origin, origin.scope, rootScope];
};

export const lookupIdentifier = (root: ASTBase): ASTBase | null => {
  // non greedy identifier to string method; can be used instead of ASTStringify
  switch (root.type) {
    case ASTType.CallStatement:
      return lookupIdentifier((root as ASTCallStatement).expression);
    case ASTType.CallExpression:
      return lookupIdentifier((root as ASTCallExpression).base);
    case ASTType.Identifier:
      return root;
    case ASTType.MemberExpression:
      return lookupIdentifier((root as ASTMemberExpression).identifier);
    case ASTType.IndexExpression:
      return lookupIdentifier((root as ASTIndexExpression).index);
    default:
      return null;
  }
};

export const lookupBase = (node: ASTBase | null = null): ASTBase | null => {
  switch (node?.type) {
    case ASTType.MemberExpression:
      return (node as ASTMemberExpression).base;
    case ASTType.IndexExpression:
      return (node as ASTIndexExpression).base;
    case ASTType.CallExpression:
      return (node as ASTCallExpression).base;
    case ASTType.SliceExpression:
      return (node as ASTSliceExpression).base;
    default:
      return null;
  }
};
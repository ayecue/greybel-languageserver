import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTCallExpression,
  ASTCallStatement,
  ASTIndexExpression,
  ASTMemberExpression,
  ASTSliceExpression,
  ASTType
} from 'miniscript-core';

export const lookupRootScope = (
  origin: ASTBaseBlockWithScope
): ASTBaseBlockWithScope => {
  let current = origin;
  while (current.scope) {
    current = current.scope;
  }
  return current;
};

export const lookupScopes = (
  origin: ASTBaseBlockWithScope
): ASTBaseBlockWithScope[] => {
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

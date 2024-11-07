import {
  ASTBase,
  ASTBaseBlockWithScope
} from 'miniscript-core';

export function getRootScope(item: ASTBase): ASTBaseBlockWithScope {
  let current: ASTBase = item;
  let next = item.scope;

  while (next != null) {
    current = next;
    next = current.scope;
  }

  return current as ASTBaseBlockWithScope;
}
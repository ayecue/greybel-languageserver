import { ASTBase, ASTType } from 'miniscript-core';
import type { FoldingRange } from 'vscode-languageserver';
import { FoldingRangeKind } from 'vscode-languageserver';

import { IActiveDocument } from '../types';
import { ScraperWalker } from './ast-scraper';

export function buildFoldingRanges(item: IActiveDocument): FoldingRange[] {
  const ranges: FoldingRange[] = [];
  const walker = new ScraperWalker((item: ASTBase, level: number) => {
    if (item.startLine === item.endLine) return null;

    switch (item.type) {
      case ASTType.MapConstructorExpression:
      case ASTType.ListConstructorExpression:
      case ASTType.StringLiteral:
      case ASTType.WhileStatement:
      case ASTType.ForGenericStatement:
      case ASTType.FunctionDeclaration: {
        ranges.push({
          startLine: item.startLine - 1,
          endLine: item.endLine - 1,
          kind: FoldingRangeKind.Region
        });
        return null;
      }
      case ASTType.IfClause:
      case ASTType.ElseifClause:
      case ASTType.ElseClause: {
        ranges.push({
          startLine: item.startLine - 1,
          endLine: item.endLine - 2,
          kind: FoldingRangeKind.Region
        });
        return null;
      }
    }

    return null;
  });
  walker.visit(item.parsedPayload);
  return ranges;
}

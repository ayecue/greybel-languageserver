import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBinaryExpression,
  ASTCallExpression,
  ASTComparisonGroupExpression,
  ASTFunctionStatement,
  ASTIdentifier,
  ASTIndexExpression,
  ASTIsaExpression,
  ASTListConstructorExpression,
  ASTWhileStatement,
  ASTForGenericStatement,
  ASTMapKeyString,
  ASTListValue,
  ASTLogicalExpression,
  ASTMapConstructorExpression,
  ASTMemberExpression,
  ASTParenthesisExpression,
  ASTSliceExpression,
  ASTType,
  ASTUnaryExpression,
  ASTCallStatement,
  ASTLiteral,
  ASTIfClause,
  ASTIfStatement,
  ASTChunk,
  ASTElseClause,
  ASTReturnStatement,
  Token,
  TokenType,
  Keyword,
  Operator
} from 'miniscript-core';
import type { SemanticTokensBuilder, SemanticTokensLegend } from 'vscode-languageserver';
import { IActiveDocument } from '../types';
import { Lexer, ASTImportCodeExpression } from 'greyscript-core';

export type SemanticToken = {
  line: number;
  char: number;
  length: number;
  tokenType: number;
  tokenModifiers?: number;
}

export enum SemanticTokenType {
  Keyword,
  String,
  Number,
  Variable,
  Property,
  Function,
  Parameter,
  Operator,
  Comment
}

export enum SemanticTokenModifier {
  Declaration
}

export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes: [
    'keyword',
    'string',
    'number',
    'variable',
    'property',
    'function',
    'parameter',
    'operator',
    'comment'
  ],
  tokenModifiers: [
    'declaration'
  ]
};

function generator(tokens: SemanticToken[], current: ASTBase, isDeclaration: boolean = false): void {
  switch (current.type) {
    case ASTType.BinaryExpression: {
      const evalExpr = current as ASTBinaryExpression;
      generator(tokens, evalExpr.left);
      generator(tokens, evalExpr.right);
      return;
    }
    case ASTType.LogicalExpression: {
      const evalExpr = current as ASTLogicalExpression;
      generator(tokens, evalExpr.left);
      generator(tokens, evalExpr.right);
      return;
    }
    case ASTType.IsaExpression: {
      const evalExpr = current as ASTIsaExpression;
      generator(tokens, evalExpr.left);
      generator(tokens, evalExpr.right);
      return;
    }
    case ASTType.ImportCodeExpression: {
      const importExpr = current as ASTImportCodeExpression;
      tokens.push({
        line: importExpr.start.line,
        char: importExpr.start.character,
        length: importExpr.end.character - importExpr.start.character,
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case ASTType.ComparisonGroupExpression: {
      const comparisonGroupExpr = current as ASTComparisonGroupExpression;
      for (let index = 0; index < comparisonGroupExpr.expressions.length; index++) {
        generator(tokens, comparisonGroupExpr.expressions[index]);
      }
      return;
    }
    case ASTType.IfStatement:
    case ASTType.IfShortcutStatement: {
      const ifStatement = current as ASTIfStatement;
      for (let index = 0; index < ifStatement.clauses.length; index++) {
        generator(tokens, ifStatement.clauses[index]);
      }
      return;
    }
    case ASTType.IfClause:
    case ASTType.ElseifClause:
    case ASTType.IfShortcutClause:
    case ASTType.ElseifShortcutClause: {
      const clause = current as ASTIfClause;
      generator(tokens, clause.condition);
      for (let index = 0; index < clause.body.length; index++) {
        generator(tokens, clause.body[index]);
      }
      return;
    }
    case ASTType.ElseClause:
    case ASTType.ElseShortcutClause: {
      const clause = current as ASTElseClause;
      for (let index = 0; index < clause.body.length; index++) {
        generator(tokens, clause.body[index]);
      }
      return;
    }
    case ASTType.ForGenericStatement: {
      const forStatement = current as ASTForGenericStatement;
      generator(tokens, forStatement.variable);
      generator(tokens, forStatement.iterator);
      for (let index = 0; index < forStatement.body.length; index++) {
        generator(tokens, forStatement.body[index]);
      }
      return;
    }
    case ASTType.AssignmentStatement: {
      const assignStatement = current as ASTAssignmentStatement;
      generator(tokens, assignStatement.variable);
      generator(tokens, assignStatement.init, true);
      return;
    }
    case ASTType.ReturnStatement: {
      const returnStatement = current as ASTReturnStatement;
      if (returnStatement.argument) generator(tokens, returnStatement.argument);
      return;
    }
    case ASTType.WhileStatement: {
      const whileStatement = current as ASTWhileStatement;
      generator(tokens, whileStatement.condition);
      for (let index = 0; index < whileStatement.body.length; index++) {
        generator(tokens, whileStatement.body[index]);
      }
      return;
    }
    case ASTType.FunctionDeclaration: {
      const fnStatement = current as ASTFunctionStatement;
      tokens.push({
        line: fnStatement.start.line,
        char: fnStatement.start.character + Keyword.Function.length,
        length: 0,
        tokenType: SemanticTokenType.Function
      });
      for (let index = 0; index < fnStatement.parameters.length; index++) {
        const parameter = fnStatement.parameters[index];
        if (parameter.type === ASTType.Identifier) {
          const idtfr = parameter as ASTIdentifier;
          tokens.push({
            line: idtfr.start.line,
            char: idtfr.start.character,
            length: idtfr.name.length,
            tokenType: SemanticTokenType.Parameter
          });
          continue;
        }
        const assignment = parameter as ASTAssignmentStatement;
        const idtfr = assignment.variable as ASTIdentifier;
        tokens.push({
          line: idtfr.start.line,
          char: idtfr.start.character,
          length: idtfr.name.length,
          tokenType: SemanticTokenType.Parameter
        });
        generator(tokens, assignment.init);
      }
      for (let index = 0; index < fnStatement.body.length; index++) {
        generator(tokens, fnStatement.body[index]);
      }
      return;
    }
    case ASTType.ParenthesisExpression: {
      const parenExpr = current as ASTParenthesisExpression;
      generator(tokens, parenExpr.expression);
      return;
    }
    case ASTType.MemberExpression: {
      const memberExpr = current as ASTMemberExpression;
      const idtfr = memberExpr.identifier as ASTIdentifier;
      tokens.push({
        line: idtfr.start.line,
        char: idtfr.start.character,
        length: idtfr.name.length,
        tokenType: SemanticTokenType.Property,
        tokenModifiers: isDeclaration ? SemanticTokenModifier.Declaration : undefined
      });
      generator(tokens, memberExpr.base);
      return;
    }
    case ASTType.IndexExpression: {
      const indexExpr = current as ASTIndexExpression;
      generator(tokens, indexExpr.index);
      generator(tokens, indexExpr.base);
      return;
    }
    case ASTType.CallStatement: {
      const callExpr = current as ASTCallStatement;
      generator(tokens, callExpr.expression);
      return;
    }
    case ASTType.CallExpression: {
      const callExpr = current as ASTCallExpression;
      generator(tokens, callExpr.base);
      for (let index = 0; index < callExpr.arguments.length; index++) {
        const arg = callExpr.arguments[index];
        generator(tokens, arg);
      }
      return;
    }
    case ASTType.NegationExpression:
    case ASTType.BinaryNegatedExpression:
    case ASTType.UnaryExpression: {
      const unaryExpr = current as ASTUnaryExpression;
      generator(tokens, unaryExpr.argument);
      return;
    }
    case ASTType.Identifier: {
      const idtfr = current as ASTIdentifier;
      tokens.push({
        line: idtfr.start.line,
        char: idtfr.start.character,
        length: idtfr.name.length,
        tokenType: SemanticTokenType.Variable,
        tokenModifiers: isDeclaration ? SemanticTokenModifier.Declaration : undefined
      });
      return;
    }
    case ASTType.NumericLiteral: {
      const literal = current as ASTLiteral;
      tokens.push({
        line: literal.start.line,
        char: literal.start.character,
        length: literal.value.toString().length,
        tokenType: SemanticTokenType.Number
      });
      return;
    }
    case ASTType.StringLiteral: {
      const literal = current as ASTLiteral;
      tokens.push({
        line: literal.start.line,
        char: literal.start.character,
        length: literal.value.toString().length,
        tokenType: SemanticTokenType.String
      });
      return;
    }
    case ASTType.NilLiteral: {
      tokens.push({
        line: current.start.line,
        char: current.start.character,
        length: current.end.character - current.start.character,
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case ASTType.BooleanLiteral: {
      tokens.push({
        line: current.start.line,
        char: current.start.character,
        length: current.end.character - current.start.character,
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case ASTType.MapConstructorExpression: {
      const mapExpr = current as ASTMapConstructorExpression;
      for (let index = 0; index < mapExpr.fields.length; index++) {
        const field = mapExpr.fields[index];
        generator(tokens, field);
      }
      return;
    }
    case ASTType.MapKeyString: {
      const mapKeyStr = current as ASTMapKeyString;
      generator(tokens, mapKeyStr.key);
      generator(tokens, mapKeyStr.value);
      return;
    }
    case ASTType.ListValue: {
      const listValue = current as ASTListValue;
      generator(tokens, listValue.value);
      return;
    }
    case ASTType.ListConstructorExpression: {
      const listExpr = current as ASTListConstructorExpression;
      for (let index = 0; index < listExpr.fields.length; index++) {
        const field = listExpr.fields[index];
        generator(tokens, field);
      }
      return;
    }
    case ASTType.SliceExpression: {
      const sliceExpr = current as ASTSliceExpression;
      generator(tokens, sliceExpr.base);
      generator(tokens, sliceExpr.left);
      generator(tokens, sliceExpr.right);
      return;
    }
    case ASTType.Chunk: {
      const chunk = current as ASTChunk;
      for (let index = 0; index < chunk.body.length; index++) {
        generator(tokens, chunk.body[index]);
      }
      return;
    }
    case ASTType.InvalidCodeExpression:
    case ASTType.EmptyExpression:
    case ASTType.Comment:
    case ASTType.BreakStatement:
    case ASTType.ContinueStatement: {
      return;
    }
  }

  console.warn(`Unexpected ast type ${current.type} in semantic token generator!`);

  return;
}

export function buildAdvancedTokens(builder: SemanticTokensBuilder, document: IActiveDocument): SemanticTokensBuilder {
  const tokens: SemanticToken[] = [];
  generator(tokens, document.document);
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    builder.push(token.line - 1, token.char - 1, token.length, token.tokenType, token.tokenModifiers);
  }
  return builder;
}


export function buildKeywordAndOperatorTokens(builder: SemanticTokensBuilder, document: IActiveDocument): SemanticTokensBuilder {
  const lexer = new Lexer(document.content, {
    unsafe: true
  });
  const operators = new Set(Object.values(Operator));
  let token: Token = lexer.next();
  while (token.type !== TokenType.EOF) {
    if (token.type === TokenType.Keyword) {
      builder.push(token.start.line - 1, token.start.character - 1, token.value.length, SemanticTokenType.Keyword, undefined);
    } else if (token.type === TokenType.Punctuator && operators.has(token.value as Operator)) {
      builder.push(token.start.line - 1, token.start.character - 1, token.value.length, SemanticTokenType.Operator, undefined);
    } else if (token.type === TokenType.Comment) {
      builder.push(token.start.line - 1, token.start.character - 1, token.value.length, SemanticTokenType.Comment, undefined);
    }
    token = lexer.next();
  }
  return builder;
}
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
import { ASTType as GreybelASTType } from 'greybel-core';
import type { SemanticTokensBuilder, SemanticTokensLegend } from 'vscode-languageserver';
import { IActiveDocument } from '../types';
import { Lexer, ASTImportCodeExpression, ASTType as GreyScriptASTType } from 'greyscript-core';
import { isNative } from 'greyscript-meta';

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
  Comment,
  Constant,
  VariableNative,
  PropertyNative,
  Punctuator
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
    'comment',
    'constant',
    'variable.native',
    'property.native',
    'punctuator'
  ],
  tokenModifiers: [
    'declaration'
  ]
};

type GeneratorContext = {
  isDeclaration?: boolean;
  isStatement?: boolean;
}

function generator(tokens: SemanticToken[], current: ASTBase, context?: GeneratorContext): void {
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
        generator(tokens, clause.body[index], { isStatement: true });
      }
      return;
    }
    case ASTType.ElseClause:
    case ASTType.ElseShortcutClause: {
      const clause = current as ASTElseClause;
      for (let index = 0; index < clause.body.length; index++) {
        generator(tokens, clause.body[index], { isStatement: true });
      }
      return;
    }
    case ASTType.ForGenericStatement: {
      const forStatement = current as ASTForGenericStatement;
      generator(tokens, forStatement.variable);
      generator(tokens, forStatement.iterator);
      for (let index = 0; index < forStatement.body.length; index++) {
        generator(tokens, forStatement.body[index], { isStatement: true });
      }
      return;
    }
    case ASTType.AssignmentStatement: {
      const assignStatement = current as ASTAssignmentStatement;
      generator(tokens, assignStatement.variable);
      generator(tokens, assignStatement.init, { isDeclaration: true });
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
        generator(tokens, whileStatement.body[index], { isStatement: true });
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
        generator(tokens, fnStatement.body[index], { isStatement: true });
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
        tokenType: isNative(['any'], idtfr.name) ? SemanticTokenType.PropertyNative : SemanticTokenType.Property,
        tokenModifiers: context?.isDeclaration ? SemanticTokenModifier.Declaration : undefined
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
        tokenType: isNative(['general'], idtfr.name) ? SemanticTokenType.VariableNative : SemanticTokenType.Variable,
        tokenModifiers: context?.isDeclaration ? SemanticTokenModifier.Declaration : undefined
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
        generator(tokens, chunk.body[index], { isStatement: true });
      }
      return;
    }
    case GreybelASTType.FeatureDebuggerExpression: {
      tokens.push({
        line: current.start.line,
        char: current.start.character,
        length: current.end.character - current.start.character,
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case GreybelASTType.FeatureEnvarExpression: {
      tokens.push({
        line: current.start.line,
        char: current.start.character,
        length: current.end.character - current.start.character,
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case GreybelASTType.FeatureFileExpression: {
      tokens.push({
        line: current.start.line,
        char: current.start.character,
        length: current.end.character - current.start.character,
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case GreybelASTType.FeatureLineExpression: {
      tokens.push({
        line: current.start.line,
        char: current.start.character,
        length: current.end.character - current.start.character,
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case GreybelASTType.FeatureInjectExpression: {
      tokens.push({
        line: current.start.line,
        char: current.start.character,
        length: current.end.character - current.start.character,
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case GreybelASTType.FeatureImportExpression: {
      tokens.push({
        line: current.start.line,
        char: current.start.character,
        length: current.start.character + 7, // #import
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case GreybelASTType.FeatureIncludeExpression: {
      tokens.push({
        line: current.start.line,
        char: current.start.character,
        length: current.start.character + 8, // #include
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case GreyScriptASTType.ImportCodeExpression: {
      const importExpr = current as ASTImportCodeExpression;
      tokens.push({
        line: importExpr.start.line,
        char: importExpr.start.character,
        length: importExpr.end.character - importExpr.start.character,
        tokenType: SemanticTokenType.Keyword
      });
      return;
    }
    case ASTType.Unknown:
    case ASTType.MapValue:
    case ASTType.MapCallExpression:
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
    } else if (token.type === TokenType.Punctuator) {
      builder.push(token.start.line - 1, token.start.character - 1, token.value.length, operators.has(token.value as Operator) ? SemanticTokenType.Operator : SemanticTokenType.Punctuator, undefined);
    } else if (token.type === TokenType.Comment) {
      builder.push(token.start.line - 1, token.start.character - 1, token.value.length, SemanticTokenType.Comment, undefined);
    }
    token = lexer.next();
  }
  return builder;
}
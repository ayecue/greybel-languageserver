import {
  GreybelKeyword,
  SelectorGroups as GreybelSelectorGroups,
  Selectors as GreybelSelectors
} from 'greybel-core';
import { GreyScriptKeyword, Lexer } from 'greyscript-core';
import { isNative } from 'greyscript-meta';
import {
  ASTType,
  Keyword,
  LiteralToken,
  Operator,
  ParserValidatorm,
  Selector,
  SelectorGroup,
  SelectorGroups,
  Selectors,
  Token,
  TokenType
} from 'miniscript-core';
import type {
  SemanticTokensBuilder,
  SemanticTokensLegend
} from 'vscode-languageserver';

import { IActiveDocument } from '../types';

export type SemanticToken = {
  line: number;
  char: number;
  length: number;
  tokenType: number;
  tokenModifiers?: number;
};

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
  Punctuator
}

export enum SemanticTokenModifier {
  Declaration,
  Definition,
  Readonly,
  Static,
  Deprecated,
  Abstract,
  Async,
  Modification,
  Documentation,
  DefaultLibrary
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
    'punctuator'
  ],
  tokenModifiers: [
    'declaration',
    'definition',
    'readonly',
    'static',
    'deprecated',
    'abstract',
    'async',
    'modification',
    'documentation',
    'defaultLibrary'
  ]
};

const getSingularModifier = (modifier: SemanticTokenModifier): number => {
  return 1 << modifier;
};

export class TokenHandler {
  // runtime
  token: Token | null;
  previousToken: Token | null;

  private _lexer: Lexer;
  private _builder: SemanticTokensBuilder;

  constructor(lexer: Lexer, builder: SemanticTokensBuilder) {
    this._lexer = lexer;
    this._builder = builder;
  }

  private next() {
    this.previousToken = this.token;
    this.token = this._lexer.next();
  }

  private isType(type: TokenType): boolean {
    return this.token !== null && type === this.token.type;
  }

  private consume(selector: Selector): boolean {
    if (selector(this.token)) {
      this.next();
      return true;
    }

    return false;
  }

  private consumeMany(selectorGroup: SelectorGroup): boolean {
    if (selectorGroup(this.token)) {
      this.next();
      return true;
    }

    return false;
  }

  private requireToken(selector: Selector): Token | null {
    const token = this.token;

    if (!selector(token)) {
      return null;
    }

    this.next();
    return token;
  }

  private processMultilineToken(token: Token, lines: string[], type: SemanticTokenType) {
    if (lines.length > 1) {
      this._builder.push(
        token.start.line - 1,
        token.start.character - 1,
        lines[0].length,
        type,
        0
      );

      for (let offset = 1; offset < lines.length; offset++) {
        this._builder.push(
          (token.start.line + offset) - 1,
          0,
          lines[offset].length,
          type,
          0
        );
      }
    } else {
      this._builder.push(
        token.start.line - 1,
        token.start.character - 1,
        lines[0].length,
        type,
        0
      );
    }
  }

  private processFunction() {
    const me = this;

    if (!SelectorGroups.BlockEndOfLine(me.token)) {
      me.next();

      const lParenToken = me.requireToken(Selectors.LParenthesis);
      if (!lParenToken) return;
      me._builder.push(
        lParenToken.start.line - 1,
        lParenToken.start.character - 1,
        lParenToken.value.length,
        SemanticTokenType.Punctuator,
        0
      );

      while (!SelectorGroups.FunctionDeclarationArgEnd(me.token)) {
        if (me.token.type !== TokenType.Identifier) {
          return;
        }

        me._builder.push(
          me.token.start.line - 1,
          me.token.start.character - 1,
          me.token.value.length,
          SemanticTokenType.Parameter,
          0
        );
        me.next();

        if (me.consume(Selectors.Assign)) {
          me._builder.push(
            me.previousToken.start.line - 1,
            me.previousToken.start.character - 1,
            me.previousToken.value.length,
            SemanticTokenType.Operator,
            0
          );

          while (!Selectors.ArgumentSeperator(me.token) && !Selectors.RParenthesis(me.token) && !Selectors.EndOfLine(me.token)) {
            me.processCurrent();
            me.next();
          }
        }

        if (!Selectors.RParenthesis(me.token)) {
          if (!Selectors.ArgumentSeperator(me.token)) return;
          me._builder.push(
            me.token.start.line - 1,
            me.token.start.character - 1,
            me.token.value.length,
            SemanticTokenType.Punctuator,
            0
          );
          me.next();
        }
      }

      if (me.consume(Selectors.RParenthesis)) {
        me._builder.push(
          me.previousToken.start.line - 1,
          me.previousToken.start.character - 1,
          me.previousToken.value.length,
          SemanticTokenType.Punctuator,
          0
        );
        return;
      }
    }
  }

  private processPathSegment() {
    const me = this;

    if (this.token.type === ASTType.StringLiteral) {
      const token = this.token as LiteralToken;
      me._builder.push(
        token.start.line - 1,
        token.start.character - 1,
        token.raw.length,
        SemanticTokenType.String,
        0
      );
      this.next();
      return;
    }

    let path: string = '';

    while (!GreybelSelectorGroups.PathSegmentEnd(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.String,
        0
      );
      path = path + me.token.value;
      me.next();
    }

    if (me.consumeMany(GreybelSelectorGroups.PathSegmentEnd)) {
      me._builder.push(
        me.previousToken.start.line - 1,
        me.previousToken.start.character - 1,
        me.previousToken.value.length,
        SemanticTokenType.Punctuator,
        0
      );
    }

    return path;
  }

  private processFeatureEnvarExpression() {
    const me = this;

    if (me.token.type !== TokenType.StringLiteral) {
      return;
    }

    me._builder.push(
      me.token.start.line - 1,
      me.token.start.character - 1,
      me.token.value.length,
      SemanticTokenType.String,
      0
    );
    me.next();
  }

  private processFeatureInjectExpression() {
    const me = this;
    me.processPathSegment();
  }

  private processFeatureImportStatement() {
    const me = this;

    if (me.token.type !== TokenType.Identifier) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Variable,
        0
      );
    }

    if (!me.consume(GreybelSelectors.From)) {
      return;
    }

    me._builder.push(
      me.previousToken.start.line - 1,
      me.previousToken.start.character - 1,
      me.previousToken.value.length,
      SemanticTokenType.Keyword,
      0
    );
    me.processPathSegment();
  }

  private processFeatureIncludeStatement() {
    const me = this;
    me.processPathSegment();
  }

  private processNativeImportCodeStatement() {
    const me = this;

    if (!me.consume(Selectors.LParenthesis)) {
      return;
    }

    me._builder.push(
      me.previousToken.start.line - 1,
      me.previousToken.start.character - 1,
      me.previousToken.value.length,
      SemanticTokenType.Punctuator,
      0
    );
    me.next();

    if (TokenType.StringLiteral !== me.token.type) {
      return;
    }

    me._builder.push(
      me.token.start.line - 1,
      me.token.start.character - 1,
      me.token.raw.length,
      SemanticTokenType.String,
      0
    );
    me.next();

    if (me.consume(Selectors.ImportCodeSeperator)) {
      me._builder.push(
        me.previousToken.start.line - 1,
        me.previousToken.start.character - 1,
        me.previousToken.value.length,
        SemanticTokenType.Punctuator,
        0
      );

      if (!me.isType(TokenType.StringLiteral)) {
        return;
      }

      const token = me.token as LiteralToken;
      me._builder.push(
        token.start.line - 1,
        token.start.character - 1,
        token.raw.length,
        SemanticTokenType.String,
        0
      );

      me.next();
    }

    if (!me.consume(Selectors.RParenthesis)) {
      return;
    }

    me._builder.push(
      me.previousToken.start.line - 1,
      me.previousToken.start.character - 1,
      me.previousToken.value.length,
      SemanticTokenType.Punctuator,
      0
    );
  }

  private processKeyword() {
    const token = this.token;

    this._builder.push(
      token.start.line - 1,
      token.start.character - 1,
      token.value.length,
      SemanticTokenType.Keyword,
      0
    );

    switch (token.value) {
      case Keyword.Function: {
        this.processFunction();
        return;
      }
      case GreybelKeyword.Include:
      case GreybelKeyword.IncludeWithComment: {
        this.processFeatureIncludeStatement();
        return;
      }
      case GreybelKeyword.Import:
      case GreybelKeyword.ImportWithComment: {
        this.processFeatureImportStatement();
        return;
      }
      case GreybelKeyword.Envar: {
        this.processFeatureEnvarExpression();
        return;
      }
      case GreybelKeyword.Inject: {
        this.processFeatureInjectExpression();
        return;
      }
      case GreybelKeyword.Debugger: {
        return;
      }
      case GreyScriptKeyword.ImportCode: {
        this.processNativeImportCodeStatement();
        return;
      }
    }
  }

  private processStringLiteral() {
    const token = this.token as LiteralToken;
    this.processMultilineToken(token as Token, token.raw.split('\n'), SemanticTokenType.String);
  }

  private processNumericLiteral() {
    const token = this.token as LiteralToken;
    this._builder.push(
      token.start.line - 1,
      token.start.character - 1,
      token.raw.length,
      SemanticTokenType.Number,
      0
    );
  }

  private processBooleanLiteral() {
    const token = this.token as LiteralToken;
    this._builder.push(
      token.start.line - 1,
      token.start.character - 1,
      token.raw.length,
      SemanticTokenType.Constant,
      0
    );
  }

  private processNilLiteral() {
    const token = this.token as LiteralToken;
    this._builder.push(
      token.start.line - 1,
      token.start.character - 1,
      token.raw.length,
      SemanticTokenType.Constant,
      0
    );
  }

  private processIdentifier() {
    const token = this.token;

    if (Selectors.MemberSeperator(this.previousToken)) {
      const isNativeIdentifier = isNative(['any'], token.value);
      const modifier = isNativeIdentifier
        ? getSingularModifier(SemanticTokenModifier.DefaultLibrary)
        : 0;

      this._builder.push(
        token.start.line - 1,
        token.start.character - 1,
        token.value.length,
        SemanticTokenType.Property,
        modifier
      );
      return;
    }

    const isNativeIdentifier = isNative(['general'], token.value);
    const modifier = isNativeIdentifier
      ? getSingularModifier(SemanticTokenModifier.DefaultLibrary)
      : 0;

    this._builder.push(
      token.start.line - 1,
      token.start.character - 1,
      token.value.length,
      SemanticTokenType.Variable,
      modifier
    );
  }

  private processPunctuator() {
    const token = this.token;

    switch (token.value) {
      case Operator.Plus:
      case Operator.Asterik:
      case Operator.Minus:
      case Operator.Slash:
      case Operator.Power:
      case Operator.Modulo:
      case Operator.LessThan:
      case Operator.LessThanOrEqual:
      case Operator.GreaterThan:
      case Operator.GreaterThanOrEqual:
      case Operator.Equal:
      case Operator.NotEqual:
      case Operator.Assign:
      case Operator.AddShorthand:
      case Operator.SubtractShorthand:
      case Operator.MultiplyShorthand:
      case Operator.DivideShorthand:
      case Operator.ModuloShorthand:
      case Operator.PowerShorthand:
      case Operator.Reference: {
        this._builder.push(
          token.start.line - 1,
          token.start.character - 1,
          token.value.length,
          SemanticTokenType.Operator,
          0
        );
        break;
      }
      default: {
        this._builder.push(
          token.start.line - 1,
          token.start.character - 1,
          token.value.length,
          SemanticTokenType.Punctuator,
          0
        );
        break;
      }
    }
  }

  private processComment() {
    if (this.token.lastLine != null) {
      this.processMultilineToken(this.token, `/*${this.token.value}*/`.split('\n'), SemanticTokenType.Comment);
    } else {
      this.processMultilineToken(this.token, `//${this.token.value}`.split('\n'), SemanticTokenType.Comment);
    }
  }

  private processCurrent() {
    const me = this;

    switch (me.token.type) {
      case TokenType.Keyword: {
        this.processKeyword();
        break;
      }
      case TokenType.StringLiteral: {
        this.processStringLiteral();
        break;
      }
      case TokenType.Identifier: {
        this.processIdentifier();
        break;
      }
      case TokenType.NumericLiteral: {
        this.processNumericLiteral();
        break;
      }
      case TokenType.Punctuator:
      case TokenType.SliceOperator: {
        this.processPunctuator();
        break;
      }
      case TokenType.BooleanLiteral: {
        this.processBooleanLiteral();
        break;
      }
      case TokenType.NilLiteral: {
        this.processNilLiteral();
        break;
      }
      case TokenType.Comment: {
        this.processComment();
        break;
      }
    }
  }

  process() {
    const me = this;

    do {
      me.next();
      me.processCurrent();
    } while (!Selectors.EndOfFile(me.token));
  }
}

export function buildTokens(
  builder: SemanticTokensBuilder,
  document: IActiveDocument
): SemanticTokensBuilder {
  const lexer = new Lexer(document.content, {
    unsafe: true
  });
  const handler = new TokenHandler(lexer, builder);
  handler.process();
  return builder;
}
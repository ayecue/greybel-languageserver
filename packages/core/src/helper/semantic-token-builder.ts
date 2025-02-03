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
  ParserValidatorm,
  PendingClauseType,
  Selector,
  SelectorGroup,
  SelectorGroups,
  Selectors,
  Token,
  TokenType
} from 'miniscript-core';
import {
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

class TokenHandler {
  // runtime
  token: Token | null;
  previousToken: Token | null;

  private _lexer: Lexer;
  private _builder: SemanticTokensBuilder;
  private _validator: ParserValidatorm;

  constructor(lexer: Lexer, builder: SemanticTokensBuilder) {
    this._lexer = lexer;
    this._builder = builder;
    this._validator = new ParserValidatorm();
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

  private requireType(type: TokenType): Token | null {
    const token = this.token;

    if (this.token.type !== type) {
      return null;
    }

    this.next();
    return token;
  }

  private requireToken(selector: Selector): Token | null {
    const token = this.token;

    if (!selector(token)) {
      return null;
    }

    this.next();
    return token;
  }

  private requireTokenOfAny(selectorGroup: SelectorGroup): Token | null {
    const token = this.token;

    if (selectorGroup(token)) {
      this.next();
      return token;
    }

    return null;
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

  private skipNewlines() {
    const me = this;
    while (true) {
      if (Selectors.Comment(me.token)) {
        if (me.token.lastLine != null) {
          me.processMultilineToken(me.token, `/*${me.token.value}*/`.split('\n'), SemanticTokenType.Comment);
        } else {
          me.processMultilineToken(me.token, `//${me.token.value}`.split('\n'), SemanticTokenType.Comment);
        }
      } else if (!Selectors.EndOfLine(me.token)) {
        break;
      }

      me.next();
    }
  }

  private processIdentifier(
    isMember: boolean = false,
    isParameter: boolean = false
  ) {
    const me = this;
    const token = me.requireType(TokenType.Identifier);

    if (!token) {
      return;
    }

    if (isParameter) {
      me._builder.push(
        token.start.line - 1,
        token.start.character - 1,
        token.value.length,
        SemanticTokenType.Parameter,
        0
      );
    } else if (isMember) {
      const isNativeIdentifier = isNative(['any'], token.value);
      const modifier = isNativeIdentifier
        ? getSingularModifier(SemanticTokenModifier.DefaultLibrary)
        : 0;
      me._builder.push(
        token.start.line - 1,
        token.start.character - 1,
        token.value.length,
        SemanticTokenType.Property,
        modifier
      );
    } else {
      const isNativeIdentifier = isNative(['general'], token.value);
      const modifier = isNativeIdentifier
        ? getSingularModifier(SemanticTokenModifier.DefaultLibrary)
        : 0;
      me._builder.push(
        token.start.line - 1,
        token.start.character - 1,
        token.value.length,
        SemanticTokenType.Variable,
        modifier
      );
    }
  }

  private processLiteral() {
    const token = this.token as LiteralToken;

    switch (token.type) {
      case TokenType.StringLiteral: {
        this.processMultilineToken(token as Token, token.raw.split('\n'), SemanticTokenType.String);
        break;
      }
      case TokenType.NumericLiteral: {
        this._builder.push(
          token.start.line - 1,
          token.start.character - 1,
          token.raw.length,
          SemanticTokenType.Number,
          0
        );
        break;
      }
      case TokenType.BooleanLiteral:
      case TokenType.NilLiteral: {
        this._builder.push(
          token.start.line - 1,
          token.start.character - 1,
          token.raw.length,
          SemanticTokenType.Constant,
          0
        );
        break;
      }
    }

    this.next();
  }

  private processAtom(
    _asLval: boolean = false,
    _statementStart: boolean = false
  ) {
    const me = this;

    if (me.token.type === TokenType.Invalid) {
      me.next();
      return;
    }

    // greybel
    if (GreybelSelectors.Envar(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Keyword,
        0
      );
      me.next();
      return me.processFeatureEnvarExpression();
    } else if (GreybelSelectors.Inject(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Keyword,
        0
      );
      me.next();
      return me.processFeatureInjectExpression();
    } else if (GreybelSelectors.Line(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Keyword,
        0
      );
      me.next();
      return;
    } else if (GreybelSelectors.File(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Keyword,
        0
      );
      me.next();
      return;
    }

    // miniscript
    if (me._validator.isLiteral(<TokenType>me.token.type)) {
      return me.processLiteral();
    } else if (me.isType(TokenType.Identifier)) {
      return me.processIdentifier();
    }
  }

  private processQuantity(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    if (!Selectors.LParenthesis(me.token)) {
      return me.processAtom(asLval, statementStart);
    }

    me._builder.push(
      me.token.start.line - 1,
      me.token.start.character - 1,
      me.token.value.length,
      SemanticTokenType.Punctuator,
      0
    );
    me.next();
    me.skipNewlines();
    me.processExpr();

    const endToken = me.requireToken(Selectors.RParenthesis);
    if (!endToken) return;
    me._builder.push(
      endToken.start.line - 1,
      endToken.start.character - 1,
      endToken.value.length,
      SemanticTokenType.Punctuator,
      0
    );
  }

  private processList(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    if (!Selectors.SLBracket(me.token)) {
      return me.processQuantity(asLval, statementStart);
    }

    me._builder.push(
      me.token.start.line - 1,
      me.token.start.character - 1,
      me.token.value.length,
      SemanticTokenType.Punctuator,
      0
    );
    me.next();

    if (Selectors.SRBracket(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Punctuator,
        0
      );
      me.next();
    } else {
      me.skipNewlines();

      while (!Selectors.EndOfFile(me.token)) {
        if (Selectors.SRBracket(me.token)) {
          me._builder.push(
            me.token.start.line - 1,
            me.token.start.character - 1,
            me.token.value.length,
            SemanticTokenType.Punctuator,
            0
          );
          me.next();
          break;
        }

        me.processExpr();

        if (Selectors.MapSeperator(me.token)) {
          me._builder.push(
            me.token.start.line - 1,
            me.token.start.character - 1,
            me.token.value.length,
            SemanticTokenType.Punctuator,
            0
          );
          me.next();
          me.skipNewlines();
        }

        if (Selectors.SRBracket(me.token)) {
          me._builder.push(
            me.token.start.line - 1,
            me.token.start.character - 1,
            me.token.value.length,
            SemanticTokenType.Punctuator,
            0
          );
          me.next();
          break;
        }
      }
    }
  }

  private processMap(asLval: boolean = false, statementStart: boolean = false) {
    const me = this;

    if (!Selectors.CLBracket(me.token)) {
      return me.processList(asLval, statementStart);
    }

    me._builder.push(
      me.token.start.line - 1,
      me.token.start.character - 1,
      me.token.value.length,
      SemanticTokenType.Punctuator,
      0
    );
    me.next();

    if (Selectors.CRBracket(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Punctuator,
        0
      );
      me.next();
    } else {
      me.skipNewlines();

      while (!Selectors.EndOfFile(me.token)) {
        if (Selectors.CRBracket(me.token)) {
          me._builder.push(
            me.token.start.line - 1,
            me.token.start.character - 1,
            me.token.value.length,
            SemanticTokenType.Punctuator,
            0
          );
          me.next();
          break;
        }

        me.processExpr();

        const sepToken = me.requireToken(Selectors.MapKeyValueSeperator);
        if (!sepToken) return;
        me._builder.push(
          sepToken.start.line - 1,
          sepToken.start.character - 1,
          sepToken.value.length,
          SemanticTokenType.Punctuator,
          0
        );

        me.skipNewlines();
        me.processExpr();

        if (Selectors.MapSeperator(me.token)) {
          me._builder.push(
            me.token.start.line - 1,
            me.token.start.character - 1,
            me.token.value.length,
            SemanticTokenType.Punctuator,
            0
          );
          me.next();
          me.skipNewlines();
        }

        if (Selectors.CRBracket(me.token)) {
          me._builder.push(
            me.token.start.line - 1,
            me.token.start.character - 1,
            me.token.value.length,
            SemanticTokenType.Punctuator,
            0
          );
          me.next();
          break;
        }
      }
    }
  }

  private processCallArgs() {
    const me = this;

    if (Selectors.LParenthesis(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Punctuator,
        0
      );
      me.next();

      if (Selectors.RParenthesis(me.token)) {
        me._builder.push(
          me.token.start.line - 1,
          me.token.start.character - 1,
          me.token.value.length,
          SemanticTokenType.Punctuator,
          0
        );
        me.next();
      } else {
        while (!Selectors.EndOfFile(me.token)) {
          me.skipNewlines();
          me.processExpr();
          me.skipNewlines();

          const nextToken = me.requireTokenOfAny(SelectorGroups.CallArgsEnd);

          if (!nextToken) {
            return;
          }

          if (Selectors.RParenthesis(nextToken)) {
            me._builder.push(
              nextToken.start.line - 1,
              nextToken.start.character - 1,
              nextToken.value.length,
              SemanticTokenType.Punctuator,
              0
            );
            break;
          } else if (!Selectors.ArgumentSeperator(nextToken)) {
            break;
          }
        }
      }
    }
  }

  private processCallExpr(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    me.processMap(asLval, statementStart);

    while (!Selectors.EndOfFile(me.token)) {
      if (Selectors.MemberSeperator(me.token)) {
        me._builder.push(
          me.token.start.line - 1,
          me.token.start.character - 1,
          me.token.value.length,
          SemanticTokenType.Punctuator,
          0
        );
        me.next();
        me.skipNewlines();
        me.processIdentifier(true);
      } else if (Selectors.SLBracket(me.token) && !me.token.afterSpace) {
        me._builder.push(
          me.token.start.line - 1,
          me.token.start.character - 1,
          me.token.value.length,
          SemanticTokenType.Punctuator,
          0
        );
        me.next();
        me.skipNewlines();

        if (Selectors.SliceSeperator(me.token)) {
          me._builder.push(
            me.token.start.line - 1,
            me.token.start.character - 1,
            me.token.value.length,
            SemanticTokenType.Punctuator,
            0
          );
          me.next();
          me.skipNewlines();

          if (Selectors.SRBracket(me.token)) {
            me._builder.push(
              me.token.start.line - 1,
              me.token.start.character - 1,
              me.token.value.length,
              SemanticTokenType.Punctuator,
              0
            );
          } else {
            me.processExpr();
          }
        } else {
          me.processExpr();

          if (Selectors.SliceSeperator(me.token)) {
            me._builder.push(
              me.token.start.line - 1,
              me.token.start.character - 1,
              me.token.value.length,
              SemanticTokenType.Punctuator,
              0
            );
            me.next();
            me.skipNewlines();

            if (Selectors.SRBracket(me.token)) {
              me._builder.push(
                me.token.start.line - 1,
                me.token.start.character - 1,
                me.token.value.length,
                SemanticTokenType.Punctuator,
                0
              );
            } else {
              me.processExpr();
            }
          }
        }

        const endToken = me.requireToken(Selectors.SRBracket);
        if (!endToken) {
          return;
        }
        me._builder.push(
          endToken.start.line - 1,
          endToken.start.character - 1,
          endToken.value.length,
          SemanticTokenType.Punctuator,
          0
        );
      } else if (
        Selectors.LParenthesis(me.token) &&
        (!asLval || !me.token.afterSpace)
      ) {
        me.processCallArgs();
      } else {
        break;
      }
    }
  }

  private processPower(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    me.processCallExpr(asLval, statementStart);

    if (Selectors.Power(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Operator,
        0
      );
      me.next();
      me.skipNewlines();
      me.processCallExpr();
    }
  }

  private processAddressOf(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    if (!Selectors.Reference(me.token)) {
      return me.processPower(asLval, statementStart);
    }

    me._builder.push(
      me.token.start.line - 1,
      me.token.start.character - 1,
      me.token.value.length,
      SemanticTokenType.Punctuator,
      0
    );
    me.next();
    me.skipNewlines();
    me.processPower();
  }

  private processNew(asLval: boolean = false, statementStart: boolean = false) {
    const me = this;

    if (!Selectors.New(me.token)) {
      return me.processAddressOf(asLval, statementStart);
    }

    me._builder.push(
      me.token.start.line - 1,
      me.token.start.character - 1,
      me.token.value.length,
      SemanticTokenType.Keyword,
      0
    );
    me.next();
    me.skipNewlines();
    me.processNew();
  }

  private processUnaryMinus(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    if (!Selectors.Minus(me.token)) {
      return me.processNew(asLval, statementStart);
    }

    me._builder.push(
      me.token.start.line - 1,
      me.token.start.character - 1,
      me.token.value.length,
      SemanticTokenType.Operator,
      0
    );
    me.next();
    me.skipNewlines();
    me.processNew();
  }

  private processMultDiv(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;
    me.processUnaryMinus(asLval, statementStart);

    while (SelectorGroups.MultiDivOperators(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Operator,
        0
      );
      me.next();
      me.skipNewlines();
      me.processUnaryMinus();
    }
  }

  private processBitwise(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    me.processMultDiv(asLval, statementStart);

    while (GreybelSelectorGroups.BitwiseOperators(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Operator,
        0
      );
      me.next();
      me.skipNewlines();
      me.processMultDiv();
    }
  }

  private processAddSub(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    me.processBitwise(asLval, statementStart);

    while (
      Selectors.Plus(me.token) ||
      (Selectors.Minus(me.token) &&
        (!statementStart || !me.token.afterSpace || me._lexer.isAtWhitespace()))
    ) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Operator,
        0
      );
      me.next();
      me.skipNewlines();
      me.processBitwise();
    }
  }

  private processComparisons(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    me.processAddSub(asLval, statementStart);

    if (!SelectorGroups.ComparisonOperators(me.token)) return;

    do {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Operator,
        0
      );
      me.next();
      me.skipNewlines();
      me.processAddSub();
    } while (SelectorGroups.ComparisonOperators(me.token));
  }

  private processBitwiseAnd(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    me.processComparisons(asLval, statementStart);

    while (GreybelSelectors.BitwiseAnd(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Punctuator,
        0
      );
      me.next();
      me.processComparisons();
    }
  }

  private processBitwiseOr(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    me.processBitwiseAnd(asLval, statementStart);

    while (GreybelSelectors.BitwiseOr(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Punctuator,
        0
      );
      me.next();
      me.processBitwiseAnd();
    }
  }

  private processIsa(asLval: boolean = false, statementStart: boolean = false) {
    const me = this;

    me.processBitwiseOr(asLval, statementStart);

    if (Selectors.Isa(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Keyword,
        0
      );
      me.next();
      me.skipNewlines();
      me.processBitwiseOr();
    }
  }

  private processNot(asLval: boolean = false, statementStart: boolean = false) {
    const me = this;

    if (Selectors.Not(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Keyword,
        0
      );
      me.next();
      me.skipNewlines();
      me.processIsa();
      return;
    }

    me.processIsa(asLval, statementStart);
  }

  private processAnd(asLval: boolean = false, statementStart: boolean = false) {
    const me = this;

    me.processNot(asLval, statementStart);

    while (Selectors.And(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Keyword,
        0
      );
      me.next();
      me.skipNewlines();
      me.processNot();
    }
  }

  private processOr(asLval: boolean = false, statementStart: boolean = false) {
    const me = this;

    me.processAnd(asLval, statementStart);

    while (Selectors.Or(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Keyword,
        0
      );
      me.next();
      me.skipNewlines();
      me.processAnd();
    }
  }

  private processFunctionDeclaration(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    const me = this;

    if (!Selectors.Function(me.token))
      return me.processOr(asLval, statementStart);

    me._builder.push(
      me.token.start.line - 1,
      me.token.start.character - 1,
      me.token.value.length,
      SemanticTokenType.Keyword,
      0
    );
    me.next();

    if (!SelectorGroups.BlockEndOfLine(me.token)) {
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
        me.processIdentifier(false, true);

        if (me.consume(Selectors.Assign)) {
          me._builder.push(
            me.previousToken.start.line - 1,
            me.previousToken.start.character - 1,
            me.previousToken.value.length,
            SemanticTokenType.Operator,
            0
          );
          me.processExpr();
        }

        if (Selectors.RParenthesis(me.token)) break;
        me._builder.push(
          me.token.start.line - 1,
          me.token.start.character - 1,
          me.token.value.length,
          SemanticTokenType.Punctuator,
          0
        );
        const sepToken = me.requireToken(Selectors.ArgumentSeperator);
        if (!sepToken) return;
        me._builder.push(
          sepToken.start.line - 1,
          sepToken.start.character - 1,
          sepToken.value.length,
          SemanticTokenType.Punctuator,
          0
        );
        if (Selectors.RParenthesis(me.token)) {
          me._builder.push(
            me.token.start.line - 1,
            me.token.start.character - 1,
            me.token.value.length,
            SemanticTokenType.Punctuator,
            0
          );
          break;
        }
      }

      const endToken = me.requireToken(Selectors.RParenthesis);
      if (!endToken) return;
      me._builder.push(
        endToken.start.line - 1,
        endToken.start.character - 1,
        endToken.value.length,
        SemanticTokenType.Punctuator,
        0
      );
    }
  }

  private processExpr(
    asLval: boolean = false,
    statementStart: boolean = false
  ) {
    this.processFunctionDeclaration(asLval, statementStart);
  }

  private processForShortcutStatement(): void {
    const me = this;
    me.processShortcutStatement();
  }

  private processForStatement(): void {
    const me = this;

    me.processIdentifier();

    const inToken = me.requireToken(Selectors.In);
    if (!inToken) return;
    me._builder.push(
      inToken.start.line - 1,
      inToken.start.character - 1,
      inToken.value.length,
      SemanticTokenType.Keyword,
      0
    );

    me.processExpr();

    if (!SelectorGroups.BlockEndOfLine(me.token)) {
      me.processForShortcutStatement();
    }
  }

  private processWhileShortcutStatement(): void {
    const me = this;
    me.processShortcutStatement();
  }

  private processWhileStatement(): void {
    const me = this;

    me.processExpr();

    if (!SelectorGroups.BlockEndOfLine(me.token)) {
      return me.processWhileShortcutStatement();
    }
  }

  private processIfShortcutStatement(): void {
    const me = this;

    me.processShortcutStatement();

    if (Selectors.Else(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Keyword,
        0
      );
      me.next();

      me.processShortcutStatement();
    }
  }

  private processNextIfClause(type: PendingClauseType | null) {
    const me = this;

    switch (type) {
      case ASTType.ElseifClause: {
        me.processExpr();
        const thenToken = me.requireToken(Selectors.Then);
        if (!thenToken) return;
        me._builder.push(
          thenToken.start.line - 1,
          thenToken.start.character - 1,
          thenToken.value.length,
          SemanticTokenType.Keyword,
          0
        );
        break;
      }
      case ASTType.ElseClause: {
        break;
      }
    }
  }

  private processIfStatement(): void {
    const me = this;

    me.processExpr();

    const thenToken = me.requireToken(Selectors.Then);
    if (!thenToken) return;
    me._builder.push(
      thenToken.start.line - 1,
      thenToken.start.character - 1,
      thenToken.value.length,
      SemanticTokenType.Keyword,
      0
    );

    if (!SelectorGroups.BlockEndOfLine(me.token)) {
      me.processIfShortcutStatement();
    }
  }

  private processReturnStatement() {
    const me = this;

    if (!SelectorGroups.ReturnStatementEnd(me.token)) {
      me.processExpr();
    }
  }

  private processAssignment() {
    const me = this;

    me.processExpr(true, true);

    if (SelectorGroups.AssignmentEndOfExpr(me.token)) {
      return;
    }

    if (Selectors.Assign(me.token)) {
      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Operator,
        0
      );
      me.next();

      me.processExpr();
      return;
    } else if (SelectorGroups.AssignmentShorthand(me.token)) {
      const op = me.token;

      me._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Operator,
        0
      );
      me.next();

      me.processExpr();

      return;
    }

    const expressions = [];

    while (!Selectors.EndOfFile(me.token)) {
      me.processExpr();

      if (SelectorGroups.BlockEndOfLine(me.token)) break;
      if (Selectors.Else(me.token)) break;
      if (Selectors.ArgumentSeperator(me.token)) {
        me.next();
        me.skipNewlines();
        continue;
      }

      const requiredToken = me.requireTokenOfAny(
        SelectorGroups.AssignmentCommandArgs
      );

      if (!requiredToken) {
        return;
      }

      if (
        Selectors.EndOfLine(requiredToken) ||
        Selectors.EndOfFile(requiredToken)
      )
        break;
    }

    if (expressions.length === 0) {
      // Call Statement
    }

    // Call Statement with args
  }

  private processShortcutStatement() {
    const me = this;

    if (TokenType.Keyword === me.token.type && Keyword.Not !== me.token.value) {
      const value = me.token.value;

      this._builder.push(
        me.token.start.line - 1,
        me.token.start.character - 1,
        me.token.value.length,
        SemanticTokenType.Keyword,
        0
      );

      switch (value) {
        case Keyword.Return: {
          me.next();
          me.processReturnStatement();
        }
        case Keyword.Continue: {
          me.next();
          return;
        }
        case Keyword.Break: {
          me.next();
          return;
        }
        default: {
        }
      }
    }

    return me.processAssignment();
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

    me.processIdentifier();

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

    if (TokenType.StringLiteral === me.token.type) {
      const token = me.token as LiteralToken;
      me._builder.push(
        token.start.line - 1,
        token.start.character - 1,
        token.raw.length,
        SemanticTokenType.String,
        0
      );
      me.next();
    } else {
      return;
    }

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
    const me = this;
    const value = me.token.value;

    this._builder.push(
      me.token.start.line - 1,
      me.token.start.character - 1,
      me.token.value.length,
      SemanticTokenType.Keyword,
      0
    );

    switch (value) {
      case Keyword.Return: {
        me.next();
        me.processReturnStatement();
        return;
      }
      case Keyword.If: {
        me.next();
        me.processIfStatement();
        return;
      }
      case Keyword.ElseIf: {
        me.next();
        me.processNextIfClause(ASTType.ElseifClause);
        return;
      }
      case Keyword.Else: {
        me.next();
        me.processNextIfClause(ASTType.ElseClause);
        return;
      }
      case Keyword.While: {
        me.next();
        me.processWhileStatement();
        return;
      }
      case Keyword.For: {
        me.next();
        me.processForStatement();
        return;
      }
      case Keyword.EndFunction: {
        me.next();
        return;
      }
      case Keyword.EndFor: {
        me.next();
        return;
      }
      case Keyword.EndWhile: {
        me.next();
        return;
      }
      case Keyword.EndIf: {
        me.next();
        return;
      }
      case Keyword.Continue: {
        me.next();
        return;
      }
      case Keyword.Break: {
        me.next();
        return;
      }
      case GreybelKeyword.Include:
      case GreybelKeyword.IncludeWithComment: {
        me.next();
        me.processFeatureIncludeStatement();
        return;
      }
      case GreybelKeyword.Import:
      case GreybelKeyword.ImportWithComment: {
        me.next();
        me.processFeatureImportStatement();
        return;
      }
      case GreybelKeyword.Envar: {
        me.next();
        me.processFeatureEnvarExpression();
        return;
      }
      case GreybelKeyword.Inject: {
        me.next();
        me.processFeatureInjectExpression();
        return;
      }
      case GreybelKeyword.Debugger: {
        me.next();
        return;
      }
      case GreyScriptKeyword.ImportCode: {
        me.next();
        me.processNativeImportCodeStatement();
      }
    }
  }

  private processStatement(): void {
    const me = this;

    if (TokenType.Keyword === me.token.type && Keyword.Not !== me.token.value) {
      me.processKeyword();
      return;
    }

    me.processAssignment();
  }

  process() {
    const me = this;
    let lastToken = null;

    me.next();

    while (!Selectors.EndOfFile(me.token)) {
      if (lastToken === me.token) {
        me.next();
      }

      lastToken = me.token;
      me.skipNewlines();

      if (Selectors.EndOfFile(me.token)) break;

      me.processStatement();
    }
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
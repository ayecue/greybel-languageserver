import { SignatureDefinitionBaseType } from 'meta-utils';
import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTChunk,
  ASTIndexExpression,
  ASTMemberExpression,
  ASTType
} from 'miniscript-core';
import {
  CompletionItem,
  CompletionItemKind,
  Document as TypeDocument,
  IEntity,
  injectIdentifers,
  isValidIdentifierLiteral
} from 'miniscript-type-analyzer';
import { ASTDefinitionItem } from 'miniscript-type-analyzer/dist/types/object';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';

import { IContext } from '../types';
import * as ASTScraper from './ast-scraper';
import { lookupBase } from './ast-utils';

export type LookupOuter = ASTBase[];

export interface LookupASTResult {
  closest: ASTBase;
  outer: LookupOuter;
}

export class LookupHelper {
  readonly document: TextDocument;
  readonly context: IContext;

  private mergedTypeMap: TypeDocument;

  constructor(document: TextDocument, context: IContext) {
    this.document = document;
    this.context = context;

    this.mergedTypeMap = null;
  }

  async getTypeMap(): Promise<TypeDocument> {
    if (this.mergedTypeMap == null) {
      this.mergedTypeMap = await this.context.documentMerger.build(
        this.document,
        this.context
      );
    }
    return this.mergedTypeMap;
  }

  async findAllAssignmentsOfIdentifier(
    identifier: string,
    root: ASTBaseBlockWithScope
  ): Promise<ASTDefinitionItem[]> {
    const typeDoc = await this.getTypeMap();

    if (typeDoc == null) {
      return [];
    }

    const context = typeDoc.getScopeContext(root);

    if (context == null) {
      return [];
    }

    return context.aggregator.resolveAvailableAssignmentsWithQuery(identifier);
  }

  async findAllAssignmentsOfItem(
    item: ASTBase,
    root: ASTBaseBlockWithScope
  ): Promise<ASTDefinitionItem[]> {
    const typeDoc = await this.getTypeMap();

    if (typeDoc == null) {
      return [];
    }

    const context = typeDoc.getScopeContext(root);

    if (context == null) {
      return [];
    }

    return context.aggregator.resolveAvailableAssignments(item);
  }

  async findAllAvailableIdentifierInRoot(): Promise<
    Map<string, CompletionItem>
  > {
    const typeDoc = await this.getTypeMap();

    if (typeDoc == null) {
      return new Map();
    }

    return typeDoc.getRootScopeContext().scope.getAvailableIdentifier();
  }

  async findAllAvailableIdentifier(
    root: ASTBaseBlockWithScope
  ): Promise<Map<string, CompletionItem>> {
    const typeDoc = await this.getTypeMap();

    if (typeDoc == null) {
      return new Map();
    }

    const context = typeDoc.getScopeContext(root);

    if (context == null) {
      return new Map();
    }

    return context.scope.getAvailableIdentifier();
  }

  async findAllAvailableIdentifierRelatedToPosition(
    item: ASTBase
  ): Promise<Map<string, CompletionItem>> {
    const typeDoc = await this.getTypeMap();
    const result: Map<string, CompletionItem> = new Map();

    if (typeDoc == null) {
      return result;
    }

    for (const assignment of typeDoc.container.getAvailableIdentifier(
      SignatureDefinitionBaseType.General
    )) {
      result.set(...assignment);
    }

    const scopeContext = typeDoc.getScopeContext(item.scope);

    if (scopeContext == null) {
      return result;
    }

    if (scopeContext.scope.isSelfAvailable()) {
      result.set('self', {
        kind: CompletionItemKind.Constant,
        line: -1
      });
    }

    if (scopeContext.scope.isSuperAvailable()) {
      result.set('super', {
        kind: CompletionItemKind.Constant,
        line: -1
      });
    }

    const localIdentifer = new Map<string, CompletionItem>();
    injectIdentifers(localIdentifer, scopeContext.scope);

    const assignments = Array.from(localIdentifer.entries())
      .map(([key, item]) => {
        return {
          identifier: key,
          ...item
        };
      })
      .sort((a, b) => a.line - b.line);

    for (let index = 0; index < assignments.length; index++) {
      const assignment = assignments[index];

      if (assignment.line >= item.end!.line) break;
      result.set(assignment.identifier, {
        kind: assignment.kind,
        line: assignment.line
      });
    }

    if (scopeContext.scope.locals !== scopeContext.scope.globals)
      injectIdentifers(result, scopeContext.scope.globals);
    if (scopeContext.scope.outer)
      injectIdentifers(result, scopeContext.scope.outer);

    return result;
  }

  async lookupAST(position: Position): Promise<LookupASTResult | null> {
    const me = this;
    const activeDocument = await this.context.documentManager.getLatest(me.document);
    const chunk = activeDocument.document as ASTChunk;
    const lineItems = chunk.lines[position.line + 1];

    if (!lineItems) {
      return null;
    }

    for (let index = 0; index < lineItems.length; index++) {
      const lineItem = lineItems[index];
      const outer = ASTScraper.findEx((item: ASTBase, _level: number) => {
        const startLine = item.start!.line - 1;
        const startCharacter = item.start!.character - 1;
        const endLine = item.end!.line - 1;
        const endCharacter = item.end!.character - 1;

        if (startLine > position.line) {
          return {
            exit: true
          };
        }

        if (startLine < endLine) {
          return {
            valid:
              (position.line > startLine && position.line < endLine) ||
              (position.line === startLine &&
                startCharacter <= position.character) ||
              (position.line === endLine && endCharacter >= position.character)
          };
        }

        return {
          valid:
            startLine <= position.line &&
            startCharacter <= position.character &&
            endLine >= position.line &&
            endCharacter >= position.character
        };
      }, lineItem) as LookupOuter;
      // get closest AST
      const closest = outer.pop();

      // nothing to get info for
      if (!closest) {
        continue;
      }

      return {
        closest,
        outer
      };
    }

    return null;
  }

  async lookupBasePath(item: ASTBase): Promise<IEntity | null> {
    const typeDoc = await this.getTypeMap();

    if (typeDoc === null) {
      return null;
    }

    const base = lookupBase(item);

    if (base) {
      return typeDoc.resolveNamespace(base);
    }

    return null;
  }

  async lookupTypeInfo({
    closest,
    outer
  }: LookupASTResult): Promise<IEntity | null> {
    const typeDoc = await this.getTypeMap();

    if (typeDoc === null) {
      return null;
    }

    const previous = outer.length > 0 ? outer[outer.length - 1] : undefined;

    if (
      previous?.type === ASTType.MemberExpression &&
      closest === (previous as ASTMemberExpression).identifier
    ) {
      return typeDoc.resolveType(previous, true);
    } else if (
      previous?.type === ASTType.IndexExpression &&
      closest === (previous as ASTIndexExpression).index &&
      isValidIdentifierLiteral(closest)
    ) {
      return typeDoc.resolveType(previous, true);
    }

    return typeDoc.resolveType(closest, true);
  }

  async lookupType(position: Position): Promise<IEntity | null> {
    const me = this;
    const astResult = await me.lookupAST(position);

    // nothing to get info for
    if (!astResult) {
      return null;
    }

    return me.lookupTypeInfo(astResult);
  }
}

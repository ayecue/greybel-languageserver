import {
  CompletionItem,
  Document as TypeDocument,
  IResolveNamespaceResult,
  IType,
  SymbolInfo
} from 'greybel-type-analyzer';
import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTChunk,
  ASTIndexExpression,
  ASTMemberExpression,
  ASTType
} from 'miniscript-core';
import { Position } from 'vscode-languageserver-textdocument';

import { IActiveDocument, IContext } from '../types';
import * as ASTScraper from './ast-scraper';
import { lookupBase } from './ast-utils';
import { isValidIdentifierLiteral } from './is-valid-identifier-literal';

export type LookupOuter = ASTBase[];

export interface LookupASTResult {
  closest: ASTBase;
  outer: LookupOuter;
}

export class LookupHelper {
  readonly document: IActiveDocument;
  readonly context: IContext;

  private mergedTypeMap: TypeDocument;

  constructor(document: IActiveDocument, context: IContext) {
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
  ): Promise<SymbolInfo[]> {
    const typeDoc = await this.getTypeMap();

    if (typeDoc == null) {
      return [];
    }

    const context = typeDoc.scopeRefMapping.get(root);

    if (context == null) {
      return [];
    }

    return context.scope.resolveAllAvailableWithQuery(identifier);
  }

  async findAllAssignmentsOfItem(item: ASTBase): Promise<IType> {
    const typeDoc = await this.getTypeMap();

    if (typeDoc == null) {
      return null;
    }

    const result = typeDoc.resolveNamespace(item, false);

    if (result == null) {
      return null;
    }

    return result.item;
  }

  async findAllAvailableIdentifierInRoot(): Promise<
    Map<string, CompletionItem>
  > {
    const typeDoc = await this.getTypeMap();

    if (typeDoc == null) {
      return new Map();
    }

    return typeDoc.globals.getAllProperties().reduce((result, it) => {
      const sources = it.type.getSource();

      result.set(it.name, {
        kind: it.kind,
        line: sources && sources.length > 0 ? sources[0].start.line - 1 : -1
      });
      return result;
    }, new Map<string, CompletionItem>());
  }

  async findAllAvailableIdentifier(
    root: ASTBaseBlockWithScope
  ): Promise<Map<string, CompletionItem>> {
    const typeDoc = await this.getTypeMap();

    if (typeDoc == null) {
      return new Map();
    }

    const context = typeDoc.scopeRefMapping.get(root);

    if (context == null) {
      return new Map();
    }

    return context.scope.getAllProperties().reduce((result, it) => {
      const sources = it.type.getSource();

      result.set(it.name, {
        kind: it.kind,
        line: sources && sources.length > 0 ? sources[0].start.line - 1 : -1
      });
      return result;
    }, new Map<string, CompletionItem>());
  }

  async findAllAvailableIdentifierRelatedToPosition(
    item: ASTBase
  ): Promise<Map<string, CompletionItem>> {
    const typeDoc = await this.getTypeMap();
    const result: Map<string, CompletionItem> = new Map();

    if (typeDoc == null) {
      return result;
    }

    const scopeContext = typeDoc.scopeRefMapping.get(item.scope);
    const properties = scopeContext.scope.getAllProperties();
    const alwaysVisibleProperties = [];
    const locationDependendProperties = [];

    for (let index = 0; index < properties.length; index++) {
      const property = properties[index];
      const sources = property.type.getSource();

      if (
        property.type.document != null &&
        property.type.document.name === typeDoc.name &&
        sources != null &&
        sources.length > 0
      ) {
        locationDependendProperties.push(property);
      } else {
        alwaysVisibleProperties.push(property);
      }
    }

    for (let index = 0; index < alwaysVisibleProperties.length; index++) {
      const property = alwaysVisibleProperties[index];
      result.set(property.name, {
        kind: property.kind,
        line: -1
      });
    }

    locationDependendProperties.sort(
      (a, b) =>
        a.type.getSource()[0].start.line - b.type.getSource()[0].start.line
    );

    for (let index = 0; index < locationDependendProperties.length; index++) {
      const property = locationDependendProperties[index];
      const source = property.type.getSource()[0];

      if (source.start.line >= item.end!.line) break;
      result.set(property.name, {
        kind: property.kind,
        line: source.start.line - 1
      });
    }

    return result;
  }

  async lookupAST(position: Position): Promise<LookupASTResult | null> {
    const me = this;
    const chunk = me.document.parsedPayload as ASTChunk;
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

  async lookupBasePath(item: ASTBase): Promise<IResolveNamespaceResult | null> {
    const typeDoc = await this.getTypeMap();

    if (typeDoc === null) {
      return null;
    }

    const base = lookupBase(item);

    if (base) {
      return typeDoc.resolveNamespace(base, true);
    }

    return null;
  }

  async lookupTypeInfo({
    closest,
    outer
  }: LookupASTResult): Promise<IResolveNamespaceResult | null> {
    const typeDoc = await this.getTypeMap();

    if (typeDoc === null) {
      return null;
    }

    const previous = outer.length > 0 ? outer[outer.length - 1] : undefined;

    if (
      previous?.type === ASTType.MemberExpression &&
      closest === (previous as ASTMemberExpression).identifier
    ) {
      return typeDoc.resolveNamespace(previous, false);
    } else if (
      previous?.type === ASTType.IndexExpression &&
      closest === (previous as ASTIndexExpression).index &&
      isValidIdentifierLiteral(closest)
    ) {
      return typeDoc.resolveNamespace(previous, false);
    }

    return typeDoc.resolveNamespace(closest, false);
  }

  async lookupType(
    position: Position
  ): Promise<IResolveNamespaceResult | null> {
    const me = this;
    const astResult = await me.lookupAST(position);

    // nothing to get info for
    if (!astResult) {
      return null;
    }

    return me.lookupTypeInfo(astResult);
  }
}

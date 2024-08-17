import {
  ASTBase,
  ASTIndexExpression,
  ASTMemberExpression
} from 'miniscript-core';
import { CompletionItem as EntityCompletionItem } from 'miniscript-type-analyzer';
import type {
  CompletionItem,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import { getCompletionItemKind } from '../helper/kind';
import { LookupHelper } from '../helper/lookup-type';
import { IContext } from '../types';
import { AVAILABLE_CONSTANTS } from './autocomplete/constants';
import { AVAILABLE_KEYWORDS } from './autocomplete/keywords';
import { AVAILABLE_OPERATORS } from './autocomplete/operators';

export const transformToCompletionItems = (
  identifer: Map<string, EntityCompletionItem>
) => {
  const items: CompletionItem[] = [];

  for (const [property, item] of identifer) {
    items.push({
      label: property,
      kind: getCompletionItemKind(item.kind)
    });
  }

  return items;
};

export const getPropertyCompletionList = async (
  helper: LookupHelper,
  item: ASTBase
): Promise<CompletionItem[]> => {
  const entity = await helper.lookupBasePath(item);

  if (entity === null) {
    return [];
  }

  return transformToCompletionItems(entity.getAllIdentifier());
};

export const getDefaultCompletionList = (): CompletionItem[] => {
  return [
    ...AVAILABLE_KEYWORDS,
    ...AVAILABLE_OPERATORS,
    ...AVAILABLE_CONSTANTS
  ];
};

export function activate(context: IContext) {
  context.connection.onCompletion(
    async (params: TextDocumentPositionParams) => {
      if (!context.getConfiguration().autocomplete) {
        return;
      }

      const document = await context.fs.getTextDocument(
        params.textDocument.uri
      );
      // waiting for changes
      const activeDocument = await context.documentManager.getLatest(document);

      const helper = new LookupHelper(activeDocument.textDocument, context);
      const astResult = helper.lookupAST(params.position);
      const completionItems: CompletionItem[] = [];
      let isProperty = false;

      if (astResult) {
        const { closest } = astResult;

        if (closest instanceof ASTMemberExpression) {
          completionItems.push(
            ...(await getPropertyCompletionList(helper, closest))
          );
          isProperty = true;
        } else if (closest instanceof ASTIndexExpression) {
          completionItems.push(
            ...(await getPropertyCompletionList(helper, closest))
          );
          isProperty = true;
        } else {
          completionItems.push(...getDefaultCompletionList());
        }
      } else {
        completionItems.push(...getDefaultCompletionList());
        completionItems.push(
          ...transformToCompletionItems(
            helper.findAllAvailableIdentifierInRoot()
          )
        );
      }

      if (!astResult || isProperty) {
        return completionItems;
      }

      const existingProperties = new Set([
        ...completionItems.map((item) => item.label)
      ]);
      const allImports = await activeDocument.getImports();

      // get all identifer available in imports
      for (const item of allImports) {
        const { document } = item;

        if (!document) {
          continue;
        }

        const importHelper = new LookupHelper(item.textDocument, context);

        completionItems.push(
          ...transformToCompletionItems(
            importHelper.findAllAvailableIdentifier(document)
          )
            .filter((item) => !existingProperties.has(item.label))
            .map((item) => {
              existingProperties.add(item.label);
              return item;
            })
        );
      }

      // get all identifer available in scope
      completionItems.push(
        ...transformToCompletionItems(
          helper.findAllAvailableIdentifierRelatedToPosition(astResult.closest)
        ).filter((item) => !existingProperties.has(item.label))
      );

      return completionItems;
    }
  );

  context.connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
      return item;
    }
  );
}

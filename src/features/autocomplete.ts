import {
  ASTBase,
  ASTIndexExpression,
  ASTMemberExpression
} from 'miniscript-core';
import { CompletionItem as EntityCompletionItem } from 'miniscript-type-analyzer';
import {
  CompletionItem,
  TextDocumentPositionParams
} from 'vscode-languageserver/node';

import ctx from '../context';
import documentManager from '../helper/document-manager';
import { getCompletionItemKind } from '../helper/kind';
import { LookupHelper } from '../helper/lookup-type';
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

export function activate() {
  ctx.connection.onCompletion(
    async (textDocumentPosition: TextDocumentPositionParams) => {
      const { position } = textDocumentPosition;

      const document = ctx.textDocumentManager.get(
        textDocumentPosition.textDocument.uri
      );
      const activeDocument = documentManager.get(document);

      const helper = new LookupHelper(activeDocument.textDocument);
      const astResult = helper.lookupAST(position);
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

        const importHelper = new LookupHelper(item.textDocument);

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

  ctx.connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
  });
}

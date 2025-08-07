import {
  ASTBase,
  ASTIndexExpression,
  ASTMemberExpression
} from 'miniscript-core';
import { CompletionItem as GreybelCompletionItem } from 'greybel-type-analyzer';
import type {
  CompletionItem,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import { CompletionListBuilder } from '../helper/completion-list-builder';
import { LookupHelper } from '../helper/lookup-type';
import { IContext } from '../types';
import { AVAILABLE_CONSTANTS } from './autocomplete/constants';
import { AVAILABLE_KEYWORDS } from './autocomplete/keywords';
import { AVAILABLE_OPERATORS } from './autocomplete/operators';

export const getPropertyCompletionList = async (
  helper: LookupHelper,
  item: ASTBase
): Promise<Map<string, GreybelCompletionItem>> => {
  const entity = await helper.lookupBasePath(item);

  if (entity === null) {
    return null;
  }

  return entity.item.getAllProperties().reduce((result, it) => {
    const sources = it.type.getSource();

    result.set(it.name, {
      kind: it.kind,
      line: sources && sources.length > 0 ? sources[0].start.line - 1 : -1
    });
    return result;
  }, new Map<string, GreybelCompletionItem>());
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

      if (document == null) {
        return;
      }

      // waiting for changes
      const activeDocument = await context.documentManager.getLatest(document);

      const helper = new LookupHelper(activeDocument, context);
      const astResult = await helper.lookupAST(params.position);
      const completionListBuilder = new CompletionListBuilder();

      if (astResult) {
        const { closest } = astResult;

        if (closest instanceof ASTMemberExpression) {
          completionListBuilder.addCollection(
            await getPropertyCompletionList(helper, closest)
          );
        } else if (closest instanceof ASTIndexExpression) {
          completionListBuilder.addCollection(
            await getPropertyCompletionList(helper, closest)
          );
        } else {
          completionListBuilder.setDefault(getDefaultCompletionList());
          completionListBuilder.addCollection(
            await helper.findAllAvailableIdentifierRelatedToPosition(
              astResult.closest
            )
          );
        }
      } else {
        completionListBuilder.setDefault(getDefaultCompletionList());
        completionListBuilder.addCollection(
          await helper.findAllAvailableIdentifierInRoot()
        );
      }

      return completionListBuilder.build();
    }
  );

  context.connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
      return item;
    }
  );
}

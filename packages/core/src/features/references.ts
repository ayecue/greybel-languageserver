import { ASTBase, ASTMemberExpression } from 'miniscript-core';
import type { ReferenceParams } from 'vscode-languageserver';

import { findAllReferences } from '../helper/find-references';
import { LookupHelper } from '../helper/lookup-type';
import { IContext } from '../types';

export function activate(context: IContext) {
  context.connection.onReferences(async (params: ReferenceParams) => {
    const document = await context.fs.getTextDocument(params.textDocument.uri);

    if (document == null) {
      return;
    }

    const parseResult = context.documentManager.get(document);

    if (!parseResult.document) {
      return;
    }

    const helper = new LookupHelper(document, context);
    const astResult = helper.lookupAST(params.position);

    if (!astResult) {
      return;
    }

    const { outer, closest } = astResult;

    const previous = outer.length > 0 ? outer[outer.length - 1] : undefined;
    let target: ASTBase = closest;

    if (previous) {
      if (
        previous instanceof ASTMemberExpression &&
        previous.identifier === closest
      ) {
        target = previous;
      }
    }

    return await findAllReferences(
      parseResult,
      target,
      params.context.includeDeclaration
    );
  });
}

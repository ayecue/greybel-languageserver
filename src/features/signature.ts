import { ASTBase, ASTCallExpression, ASTType } from 'miniscript-core';
import { SignatureHelp, SignatureHelpParams } from 'vscode-languageserver/node';

import ctx from '../context';
import documentManager from '../helper/document-manager';
import { LookupASTResult, LookupHelper } from '../helper/lookup-type';
import { createSignatureInfo } from '../helper/tooltip';

const getClosestCallExpression = (
  astResult: LookupASTResult
): ASTCallExpression | null => {
  if (astResult.closest.type === ASTType.CallExpression) {
    return astResult.closest as ASTCallExpression;
  }

  for (let index = astResult.outer.length - 1; index >= 0; index--) {
    const current = astResult.outer[index];

    if (current.type === ASTType.CallExpression) {
      return current as ASTCallExpression;
    }
  }

  return null;
};

export function activate() {
  ctx.connection.onSignatureHelp(async (params: SignatureHelpParams) => {
    const document = ctx.textDocumentManager.get(params.textDocument.uri);
    documentManager.refresh(document);
    const helper = new LookupHelper(document);
    const astResult = helper.lookupAST(params.position);

    if (!astResult) {
      return;
    }

    // filter out root call expression for signature
    const { closest } = astResult;
    const closestCallExpr = getClosestCallExpression(astResult);

    if (closestCallExpr === null) {
      return;
    }

    const item = await helper.lookupTypeInfo({
      closest: closestCallExpr.base,
      outer: closest.scope ? [closest.scope] : []
    });

    if (!item || !item.isCallable()) {
      return;
    }

    // figure out argument position
    const astArgs = closestCallExpr.arguments;
    const selectedIndex = astArgs.findIndex((argItem: ASTBase) => {
      const leftIndex = argItem.start!.character - 1;
      const rightIndex = argItem.end!.character;

      return (
        leftIndex <= params.position.character &&
        rightIndex >= params.position.character
      );
    });

    const signatureHelp: SignatureHelp = {
      activeParameter: selectedIndex === -1 ? 0 : selectedIndex,
      signatures: [],
      activeSignature: 0
    };

    signatureHelp.signatures.push(...createSignatureInfo(item));

    return signatureHelp;
  });
}

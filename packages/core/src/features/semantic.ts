import {
  SemanticTokensBuilder,
  type SemanticTokensParams,
} from 'vscode-languageserver';

import { IContext } from '../types';
import { buildAdvancedTokens, buildKeywordAndOperatorTokens } from '../helper/semantic-token-builder';

export function activate(context: IContext) {
  context.connection.languages.semanticTokens.on(async (params: SemanticTokensParams) => {
    const document = await context.fs.getTextDocument(params.textDocument.uri);

    if (document == null) {
      return;
    }

    const parseResult = context.documentManager.get(document);

    if (!parseResult.document) {
      return;
    }

    const builder = context.createSemanticTokensBuilder();

    buildKeywordAndOperatorTokens(builder, parseResult);
    buildAdvancedTokens(builder, parseResult);

    return builder.build();
  });
}

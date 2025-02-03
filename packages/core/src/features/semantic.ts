import type { SemanticTokensParams } from 'vscode-languageserver';

import { buildTokens } from '../helper/semantic-token-builder';
import { IContext } from '../types';

export function activate(context: IContext) {
  context.connection.languages.semanticTokens.on(
    async (params: SemanticTokensParams) => {
      const document = await context.fs.getTextDocument(
        params.textDocument.uri
      );

      if (document == null) {
        return;
      }

      const parseResult = await context.documentManager.getLatest(document);

      if (!parseResult.document) {
        return;
      }

      const builder = context.createSemanticTokensBuilder();

      buildTokens(builder, parseResult);

      return builder.build();
    }
  );
}

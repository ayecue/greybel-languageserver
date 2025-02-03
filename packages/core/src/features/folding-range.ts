import type { FoldingRange, FoldingRangeParams } from 'vscode-languageserver';

import { buildFoldingRanges } from '../helper/folding-range-builder';
import { IContext } from '../types';

export function activate(context: IContext) {
  context.connection.languages.foldingRange.on(
    async (params: FoldingRangeParams): Promise<FoldingRange[]> => {
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

      return buildFoldingRanges(parseResult);
    }
  );
}

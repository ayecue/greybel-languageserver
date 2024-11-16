import type {
  FoldingRange,
  FoldingRangeParams,
} from 'vscode-languageserver';

import { IContext } from '../types';
import { buildFoldingRanges } from '../helper/folding-range-builder';

export function activate(context: IContext) {
  context.connection.languages.foldingRange.on(async (params: FoldingRangeParams): Promise<FoldingRange[]> => {
    const document = await context.fs.getTextDocument(params.textDocument.uri);

    if (document == null) {
      return;
    }

    const parseResult = context.documentManager.get(document);

    if (!parseResult.document) {
      return;
    }

    return buildFoldingRanges(parseResult);
  });
}

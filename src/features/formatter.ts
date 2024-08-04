import { BuildType } from 'greybel-transpiler';
import { DirectTranspiler } from 'greyscript-transpiler';
import {
  DocumentFormattingParams,
  Range,
  TextEdit
} from 'vscode-languageserver';

import ctx from '../context';
import documentManager from '../helper/document-manager';
import { IConfiguration } from '../types';

export function activate() {
  async function tryFormat(content: string): Promise<string | null> {
    try {
      const config: IConfiguration =
        await ctx.connection.workspace.getConfiguration('greybel');

      return new DirectTranspiler({
        code: content,
        buildType: BuildType.BEAUTIFY,
        buildOptions: {
          isDevMode: true,
          keepParentheses: config.transpiler.beautify.keepParentheses,
          indentation: config.transpiler.beautify.indentation === 'Tab' ? 0 : 1,
          indentationSpaces: config.transpiler.beautify.indentationSpaces
        }
      }).parse();
    } catch (err) {
      return null;
    }
  }

  ctx.connection.onDocumentFormatting(
    async (params: DocumentFormattingParams) => {
      const document = ctx.textDocumentManager.get(params.textDocument.uri);
      const activeDocument = documentManager.get(document);
      const result = await tryFormat(document.getText());

      if (result === null) {
        return [];
      }

      const textRange: Range = {
        start: activeDocument.document.start,
        end: activeDocument.document.end
      };

      return [TextEdit.replace(textRange, result)];
    }
  );
}

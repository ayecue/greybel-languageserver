import { BuildType } from 'greybel-transpiler';
import { DirectTranspiler } from 'greyscript-transpiler';
import {
  DocumentFormattingParams,
  Range,
  TextEdit
} from 'vscode-languageserver/node';

import documentManager from '../helper/document-manager';
import { IConfiguration, IContext } from '../types';

export function activate(context: IContext) {
  async function tryFormat(content: string): Promise<string | null> {
    try {
      const config: IConfiguration =
        await context.connection.workspace.getConfiguration('greybel');

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

  context.connection.onDocumentFormatting(
    async (params: DocumentFormattingParams) => {
      const document = await context.fs.getTextDocument(
        params.textDocument.uri
      );
      const activeDocument = documentManager.get(document);
      const result = await tryFormat(document.getText());

      if (result === null) {
        return [];
      }

      const textRange: Range = {
        start: { line: 0, character: 0 },
        end: activeDocument.document.end
      };

      return [TextEdit.replace(textRange, result)];
    }
  );
}

import {
  ASTFeatureImportExpression,
  ASTType as ASTTypeExtended
} from 'greybel-core';
import { ASTImportCodeExpression, ASTType } from 'greyscript-core';
import {
  SignatureDefinitionBaseType,
  SignatureDefinitionTypeMeta
} from 'meta-utils';
import path from 'path';
import type { Hover, HoverParams } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';

import { LookupASTResult, LookupHelper } from '../helper/lookup-type';
import { MarkdownString } from '../helper/markdown-string';
import { createHover, formatTypes } from '../helper/tooltip';
import { IContext, LanguageId } from '../types';

const getRootDirectory = async (
  context: IContext,
  textDocument: TextDocument,
  target: string
) => {
  const textDocumentUri = URI.parse(textDocument.uri);
  const workspaceFolderUri =
    await context.fs.getWorkspaceFolderUri(textDocumentUri);
  if (workspaceFolderUri == null) {
    return Utils.joinPath(textDocumentUri, '..');
  }
  return target.startsWith('/')
    ? workspaceFolderUri
    : Utils.joinPath(textDocumentUri, '..');
};

export function activate(context: IContext) {
  async function generateImportCodeHover(
    textDocument: TextDocument,
    astResult: LookupASTResult
  ): Promise<Hover> {
    const hoverText = new MarkdownString('');
    const importAst = astResult.closest as ASTImportCodeExpression;
    const rootDir = await getRootDirectory(
      context,
      textDocument,
      importAst.directory
    );
    const target = await context.fs.findExistingPath(
      Utils.joinPath(rootDir, importAst.directory).toString()
    );
    const output =
      target == null
        ? ['Cannot open file.']
        : [
            `[Imports file "${path.basename(
              target
            )}" inside this code](${target})`,
            '***',
            'Click the link above to open the file.',
            '',
            'Use the build command to create an installer',
            'file which will bundle all dependencies.'
          ];

    hoverText.appendMarkdown(output.join('\n'));

    return {
      contents: hoverText.toString()
    };
  }

  async function generateImportHover(
    textDocument: TextDocument,
    astResult: LookupASTResult
  ): Promise<Hover> {
    // shows link to import/include resource
    const hoverText = new MarkdownString('');
    const importCodeAst = astResult.closest as ASTFeatureImportExpression;
    const fileDir = importCodeAst.path;

    const rootDir = await getRootDirectory(context, textDocument, fileDir);
    const result = Utils.joinPath(rootDir, fileDir);
    const resultAlt = Utils.joinPath(rootDir, `${fileDir}`);
    const target = await context.fs.findExistingPath(
      result.toString(),
      resultAlt.toString()
    );
    const output: string[] =
      target == null
        ? ['Cannot open file.']
        : [
            `[Inserts file "${path.basename(
              target
            )}" inside this code when building](${target})`,
            '***',
            'Click the link above to open the file.'
          ];

    hoverText.appendMarkdown(output.join('\n'));

    return {
      contents: hoverText.toString()
    };
  }

  context.connection.onHover(async (params: HoverParams): Promise<Hover> => {
    if (!context.getConfiguration().hoverdocs) {
      return;
    }

    const document = await context.fs.getTextDocument(params.textDocument.uri);

    if (document == null) {
      return;
    }

    const helper = new LookupHelper(document, context);
    const astResult = helper.lookupAST(params.position);

    if (!astResult) {
      return;
    }

    if (astResult.closest.type === ASTType.ImportCodeExpression) {
      return await generateImportCodeHover(document, astResult);
    } else if (
      astResult.closest.type === ASTTypeExtended.FeatureImportExpression ||
      astResult.closest.type === ASTTypeExtended.FeatureIncludeExpression
    ) {
      return await generateImportHover(document, astResult);
    }

    const entity = await helper.lookupTypeInfo(astResult);

    if (!entity) {
      return;
    }

    if (entity.isCallable()) {
      return createHover(entity);
    }

    const hoverText = new MarkdownString('');
    const metaTypes = Array.from(entity.types).map(
      SignatureDefinitionTypeMeta.parse
    );
    let label = `(${entity.kind}) ${entity.label}: ${formatTypes(metaTypes)}`;

    if (entity.types.has(SignatureDefinitionBaseType.Map)) {
      const records: Record<string, string> = {};

      for (const [key, item] of entity.values) {
        const metaTypes = Array.from(item.types).map(
          SignatureDefinitionTypeMeta.parse
        );
        records[key.slice(2)] = formatTypes(metaTypes);
      }

      label += ' ' + JSON.stringify(records, null, 2);
    }

    hoverText.appendCodeblock(LanguageId, label);

    return {
      contents: hoverText.toString()
    };
  });
}

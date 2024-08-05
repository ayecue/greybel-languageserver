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
import { Hover, HoverParams } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';

import ctx from '../context';
import { LookupASTResult, LookupHelper } from '../helper/lookup-type';
import { MarkdownString } from '../helper/markdown-string';
import { createHover, formatTypes } from '../helper/tooltip';

async function generateImportCodeHover(
  textDocument: TextDocument,
  astResult: LookupASTResult
): Promise<Hover> {
  const hoverText = new MarkdownString('');
  const importAst = astResult.closest as ASTImportCodeExpression;
  const workspaceFolders = await ctx.getWorkspaceFolderUris();
  const rootDir = importAst.directory.startsWith('/')
    ? workspaceFolders[0]
    : Utils.joinPath(URI.parse(textDocument.uri), '..');
  const target = Utils.joinPath(rootDir, importAst.directory);
  const output = [
    `[Imports file "${path.basename(
      target.path
    )}" inside this code](${target.toString()})`,
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

  const workspaceFolders = await ctx.getWorkspaceFolderUris();
  const rootDir = fileDir.startsWith('/')
    ? workspaceFolders[0]
    : Utils.joinPath(URI.parse(textDocument.uri), '..');
  const result = Utils.joinPath(rootDir, fileDir);
  const resultAlt = Utils.joinPath(rootDir, `${fileDir}`);
  const target = await ctx.findExistingPath(
    result.toString(),
    resultAlt.toString()
  );

  const output = [
    `[Inserts file "${path.basename(
      target
    )}" inside this code when building](${target.toString()})`,
    '***',
    'Click the link above to open the file.'
  ];

  hoverText.appendMarkdown(output.join('\n'));

  return {
    contents: hoverText.toString()
  };
}

export function activate() {
  ctx.connection.onHover(async (params: HoverParams): Promise<Hover> => {
    const document = await ctx.getTextDocument(params.textDocument.uri);
    const helper = new LookupHelper(document);
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

    hoverText.appendCodeblock('greyscript', label);

    return {
      contents: hoverText.toString()
    };
  });
}

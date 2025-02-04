import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

async function executeSemanticTokenProvider(
  docUri
) {
  await activate(docUri);

  return await vscode.commands.executeCommand<vscode.SemanticTokens>(
    'vscode.provideDocumentSemanticTokens',
    docUri
  );
}

suite('DocumentSemanticTokenProvider', () => {
  suite('default', () => {
    test('should provide semantic token list', async () => {
      const documentUri = getDocUri('default.src');
      const result = await executeSemanticTokenProvider(documentUri);

      assert.strictEqual(result.data.byteLength, 1520);
    });
  });

  suite('invalid code', () => {
    test('should provide semantic token list', async () => {
      const documentUri = getDocUri('invalid-chunk.src');
      const result = await executeSemanticTokenProvider(documentUri);

      assert.strictEqual(result.data.byteLength, 200);
    });
  });
});
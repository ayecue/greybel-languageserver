import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

async function executeFoldingRangeProvider(
  docUri
) {
  await activate(docUri);

  return await vscode.commands.executeCommand<vscode.FoldingRange[]>(
    'vscode.executeFoldingRangeProvider',
    docUri
  );
}

suite('FoldingRangeProvider', () => {
  suite('default', () => {
    test('should provide folding ranges', async () => {
      const documentUri = getDocUri('class.src');
      const result = await executeFoldingRangeProvider(documentUri);

      assert.strictEqual(result.length, 32);
    });
  });

  suite('invalid code', () => {
    test('should provide no folding ranges', async () => {
      const documentUri = getDocUri('invalid-chunk.src');
      const result = await executeFoldingRangeProvider(documentUri);

      assert.strictEqual(result.length, 0);
    });
  });
});
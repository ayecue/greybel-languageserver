import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

async function executeCompletionItemProvider(
  docUri,
  position
) {
  await activate(docUri);

  return await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider',
    docUri,
    position
  );
}

suite('CompletionItemProvider', () => {
  suite('invalid code', () => {
    test('should return completion list with invalid chunk', async () => {
      const documentUri = getDocUri('invalid-chunk.src');
      const result = await executeCompletionItemProvider(documentUri, new vscode.Position(6, 1));

      assert.strictEqual(result.items.length, 309);
    });
  });
});
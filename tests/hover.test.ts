import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

async function executeHoverProvider(
  docUri,
  position
) {
  await activate(docUri);

  return await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider',
    docUri,
    position
  );
}

suite('HoverProvider', () => {
  suite('invalid code', () => {
    test('should return hover list with invalid chunk', async () => {
      const documentUri = getDocUri('invalid-chunk.src');
      const result = await executeHoverProvider(documentUri, new vscode.Position(4, 1));

      assert.strictEqual(result.length, 1);
    });
  });
});
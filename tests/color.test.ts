import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

async function executeColorProvider(
  docUri
) {
  await activate(docUri);

  return await vscode.commands.executeCommand<vscode.ColorInformation[]>(
    'vscode.executeDocumentColorProvider',
    docUri
  );
}

suite('DocumentColorProvider', () => {
  suite('invalid code', () => {
    test('should provide color information list with invalid chunk', async () => {
      const documentUri = getDocUri('invalid-chunk.src');
      const result = await executeColorProvider(documentUri);

      assert.strictEqual(result.length, 0);
    });
  });
});
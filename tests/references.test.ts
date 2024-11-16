import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

async function executeReferenceProvider(
  docUri,
  position: vscode.Position
) {
  await activate(docUri);

  return await vscode.commands.executeCommand<vscode.Location[]>(
    'vscode.executeReferenceProvider',
    docUri,
    position
  );
}

suite('ReferenceProvider', () => {
  suite('default', () => {
    test('should provide locations', async () => {
      const documentUri = getDocUri('default.src');
      const result = await executeReferenceProvider(documentUri, new vscode.Position(30, 2));

      assert.strictEqual(result.length, 4);
    });
  });

  suite('class', () => {
    test('should provide locations', async () => {
      const documentUri = getDocUri('class.src');
      const result = await executeReferenceProvider(documentUri, new vscode.Position(0, 2));

      assert.strictEqual(result.length, 12);
    });
  });

  suite('invalid code', () => {
    test('should provide locations', async () => {
      const documentUri = getDocUri('invalid-chunk.src');
      const result = await executeReferenceProvider(documentUri, new vscode.Position(5, 2));

      assert.strictEqual(result.length, 0);
    });
  });
});
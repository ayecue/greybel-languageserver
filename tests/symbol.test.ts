import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

async function executeDocumentSymbolProvider(
  docUri
) {
  await activate(docUri);

  return await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    'vscode.executeDocumentSymbolProvider',
    docUri
  );
}

suite('DocumentSymbolProvider', () => {
  suite('default', () => {
    test('should provide locations', async () => {
      const documentUri = getDocUri('default.src');
      const result = await executeDocumentSymbolProvider(documentUri);

      assert.strictEqual(result.length, 10);
    });
  });

  suite('class', () => {
    test('should provide locations', async () => {
      const documentUri = getDocUri('class.src');
      const result = await executeDocumentSymbolProvider(documentUri);

      assert.strictEqual(result.length, 106);
    });
  });

  suite('invalid code', () => {
    test('should provide locations', async () => {
      const documentUri = getDocUri('invalid-chunk.src');
      const result = await executeDocumentSymbolProvider(documentUri);

      assert.strictEqual(result.length, 2);
    });
  });
});
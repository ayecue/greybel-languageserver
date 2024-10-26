import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

async function getDiagnostics(
  docUri
) {
  await activate(docUri);
  return vscode.languages.getDiagnostics(docUri);
}

suite('Diagnostics', () => {
  suite('invalid code', () => {
    test('should provide diagnostics list with invalid chunk', async () => {
      const documentUri = getDocUri('invalid-chunk.src');
      const result = await getDiagnostics(documentUri);

      assert.strictEqual(result.length, 2);
    });
  });
});
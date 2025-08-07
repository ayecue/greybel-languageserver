import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

async function executeDocumentSymbolProvider(
  docUri
) {
  await activate(docUri);

  return await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    docUri
  );
}

suite('DocumentSymbolProvider', () => {
  suite('default', () => {
    test('should provide locations', async () => {
      const documentUri = getDocUri('default.src');
      const result = await executeDocumentSymbolProvider(documentUri);
      const allSymbols = result.flatMap(symbol => {
        return symbol.children ? [symbol, ...symbol.children] : [symbol];
      });

      assert.strictEqual(allSymbols.length, 10);
    });
  });

  suite('class', () => {
    test('should provide locations', async () => {
      const documentUri = getDocUri('class.src');
      const result = await executeDocumentSymbolProvider(documentUri);
      const allSymbols = result.flatMap(symbol => {
        return symbol.children ? [symbol, ...symbol.children] : [symbol];
      });

      assert.strictEqual(allSymbols.length, 65);
    });
  });

  suite('invalid code', () => {
    test('should provide locations', async () => {
      const documentUri = getDocUri('invalid-chunk.src');
      const result = await executeDocumentSymbolProvider(documentUri);

      assert.strictEqual(result, undefined);
    });
  });
});
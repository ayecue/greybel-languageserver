import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Activates the vscode.lsp-sample extension
 */
export async function activate(docUri) {
  // The extensionId is `publisher.name` from package.json
  try {
    const extension = vscode.extensions.getExtension('vscode-samples.lsp-sample')!;
    await extension.activate();
    const document = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(document);
    await sleep(2000); // Wait for server activation
    return {
      extension,
      document,
      editor
    };
  } catch (e) {
    console.error('Failed activating', e);
  }

  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getDocUri(docPath) {
  return vscode.Uri.file(path.resolve(__dirname, 'fixtures', docPath));
}
import { ExtensionContext } from 'vscode';

import { activate as activateLanguageClient } from './client';

export function activate(context: ExtensionContext) {
  activateLanguageClient(context);
}

export function deactivate() { }

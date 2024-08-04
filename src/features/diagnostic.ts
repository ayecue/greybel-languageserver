import { ASTRange } from 'miniscript-core';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import ctx from '../context';
import documentManager from '../helper/document-manager';

function lookupErrors(document: TextDocument): Diagnostic[] {
  const activeDocument = documentManager.get(document);

  return activeDocument.errors.map((err: any) => {
    // Lexer error and Parser error
    if (err?.range) {
      const range: ASTRange = err.range;
      return {
        range: {
          start: {
            line: range.start.line - 1,
            character: range.start.character - 1
          },
          end: {
            line: range.end.line - 1,
            character: range.end.character - 1
          }
        },
        message: err.message,
        severity: DiagnosticSeverity.Error
      };
    }

    return {
      range: {
        start: activeDocument.document.start,
        end: activeDocument.document.end
      },
      message: err.message,
      severity: DiagnosticSeverity.Error
    };
  });
}

export function activate() {
  documentManager.on('parsed', (document: TextDocument) => {
    const diagnostics = lookupErrors(document);

    if (diagnostics.length === 0) return;

    ctx.connection.sendDiagnostics({
      uri: document.uri,
      diagnostics
    });
  });

  documentManager.on('cleared', (document: TextDocument) => {
    ctx.connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: []
    });
  });
}

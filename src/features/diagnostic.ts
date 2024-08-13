import { ASTRange } from 'miniscript-core';
import {
  Diagnostic,
  DiagnosticSeverity,
  DocumentDiagnosticParams,
  DocumentDiagnosticReportKind
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import documentManager from '../helper/document-manager';
import { IContext } from '../types';

async function lookupErrors(document: TextDocument): Promise<Diagnostic[]> {
  const activeDocument = await documentManager.getLatest(document);

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

export function activate(context: IContext) {
  context.connection.languages.diagnostics.on(
    async (params: DocumentDiagnosticParams) => {
      const document = await context.fs.getTextDocument(
        params.textDocument.uri
      );
      const diagnostics = await lookupErrors(document);

      if (diagnostics.length === 0) {
        return {
          kind: DocumentDiagnosticReportKind.Full,
          items: []
        };
      }

      return {
        kind: DocumentDiagnosticReportKind.Full,
        items: diagnostics
      };
    }
  );
}

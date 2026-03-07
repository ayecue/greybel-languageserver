import { ASTRange } from 'miniscript-core';
import type {
  Diagnostic,
  DocumentDiagnosticParams
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { IContext } from '../types';

async function lookupErrors(
  document: TextDocument,
  context: IContext
): Promise<Diagnostic[]> {
  const activeDocument = await context.documentManager.getLatest(document);

  return activeDocument.errors.map((err: any) => {
    // Lexer error and Parser error
    if (err?.range) {
      const range: ASTRange = err.range;
      return {
        range: {
          start: {
            line: range.start[0] - 1,
            character: range.start[1] - 1
          },
          end: {
            line: range.end[0] - 1,
            character: range.end[1] - 1
          }
        },
        message: err.message,
        severity: 1 // Error
      };
    }

    return {
      range: {
        start: {
          line: activeDocument.parsedPayload.startLine - 1,
          character: activeDocument.parsedPayload.startChar - 1
        },
        end: {
          line: activeDocument.parsedPayload.endLine - 1,
          character: activeDocument.parsedPayload.endChar - 1
        }
      },
      message: err.message,
      severity: 1 // Error
    };
  });
}

export function activate(context: IContext) {
  context.connection.languages.diagnostics.on(
    async (params: DocumentDiagnosticParams) => {
      if (!context.getConfiguration().diagnostic) {
        return;
      }

      const document = await context.fs.getTextDocument(
        params.textDocument.uri
      );

      if (document == null) {
        return;
      }

      const diagnostics = await lookupErrors(document, context);

      if (diagnostics.length === 0) {
        return {
          kind: 'full',
          items: []
        };
      }

      return {
        kind: 'full',
        items: diagnostics
      };
    }
  );
}

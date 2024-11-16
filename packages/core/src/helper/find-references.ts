import {
  ASTBase,
  ASTType
} from 'miniscript-core';
import type { Location, Position } from 'vscode-languageserver';

import { IActiveDocument } from '../types';
import { findDocumentReferences } from './ast-utils';

const createLocation = (item: ASTBase, location: string): Location => {
  const start: Position = {
    line: item.start.line - 1,
    character: item.start.character - 1
  };
  const end: Position = {
    line: item.end.line - 1,
    character: item.end.character - 1
  };

  return {
    uri: location,
    range: { start, end }
  };
};
export const findDocumentReferenceLocations = (
  document: IActiveDocument,
  target: ASTBase,
  includeDeclaration: boolean = false
): Location[] => {
  return findDocumentReferences(document.document, target, includeDeclaration).map((item) => {
    return createLocation(item, document.textDocument.uri);
  });
};

export const findAllReferences = async (
  document: IActiveDocument,
  target: ASTBase,
  includeDeclaration: boolean = false
): Promise<Location[]> => {
  let references: Location[] = [];

  if (
    target.type !== ASTType.Identifier &&
    target.type !== ASTType.MemberExpression
  ) {
    return references;
  }

  const imports = await document.getImports();
  const documents = [document, ...imports];

  for (let index = 0; index < documents.length; index++) {
    const doc = documents[index];
    references = references.concat(
      findDocumentReferenceLocations(doc, target, includeDeclaration)
    );
  }

  return references;
};

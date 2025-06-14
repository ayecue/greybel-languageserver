import { ASTChunkGreyScript } from 'greyscript-core';
import { ASTPosition } from 'miniscript-core';
import { greyscriptMeta } from 'greyscript-meta';
import { TypeManager, Document as TypeDocument } from 'miniscript-type-analyzer';
import { IActiveDocument, parseDependencyRawLocation } from '../types';

export type ImportWithNamespace = {
  namespace: string;
  typeDoc: TypeDocument;
};

const typeManager = new TypeManager({
  container: greyscriptMeta
});

export default typeManager;

export function createTypeDocumentWithNamespaces(
  origin: TypeDocument,
  items: ImportWithNamespace[]
) {
  const typeDoc = new TypeDocument({
    source: origin.source,
    // @ts-expect-error
    container: typeManager._container,
    root: new ASTChunkGreyScript({
      start: new ASTPosition(0, 0),
      end: new ASTPosition(0, 0),
      range: [0, 0],
    })
  });

  typeDoc.analyze();

  items.forEach((item) => {
    const entity = item.typeDoc
      .getRootScopeContext()
      .scope.resolveNamespace('module', true)
      ?.resolveProperty('exports', true);

    if (entity == null) return;

    const rootScope = typeDoc.getRootScopeContext().scope;
    rootScope.setProperty(item.namespace, entity, true);
  });

  return typeDoc;
}

export async function aggregateImportsWithNamespace(
  activeDocument: IActiveDocument,
  refs?: Map<string, TypeDocument | null>
): Promise<ImportWithNamespace[]> {
  const result: ImportWithNamespace[] = [];

  if (activeDocument == null) {
    return result;
  }

  const importUris = await activeDocument.getImportUris();

  importUris.forEach((rawLocation) => {
    const importDef = parseDependencyRawLocation(rawLocation);
    const namespace = importDef.args[0];
    if (namespace == null) return;
    const itemTypeDoc = refs?.get(importDef.location) ?? typeManager.get(importDef.location);
    if (itemTypeDoc === null) return;
    result.push({
      namespace,
      typeDoc: itemTypeDoc
    });
  });

  return result;
}
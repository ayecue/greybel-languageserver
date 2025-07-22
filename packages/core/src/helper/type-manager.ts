import { ASTChunkGreyScript } from 'greyscript-core';
import { greyscriptMeta } from 'greyscript-meta';
import { ASTPosition } from 'miniscript-core';
import {
  Document as TypeDocument,
  TypeManager
} from 'miniscript-type-analyzer';

import {
  DependencyType,
  IActiveDocument,
  IActiveDocumentImportGraphNode,
  IDependencyLocation
} from '../types';

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
      range: [0, 0]
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

export function aggregateImportsWithNamespaceFromLocations(
  dependencyLocation: IDependencyLocation[],
  refs: Map<string, IActiveDocument | null>
): ImportWithNamespace[] {
  const result: ImportWithNamespace[] = [];

  if (dependencyLocation == null) {
    return result;
  }

  dependencyLocation.forEach((importDef) => {
    const namespace = importDef.args[0];
    if (namespace == null) return;
    const itemTypeDoc = refs.get(importDef.location)?.typeDocument;
    if (itemTypeDoc == null) return;
    result.push({
      namespace,
      typeDoc: itemTypeDoc
    });
  });

  return result;
}

export function aggregateImportsWithNamespaceFromGraph(
  node: IActiveDocumentImportGraphNode,
  refs: Map<string, TypeDocument | null>
): ImportWithNamespace[] {
  const result: ImportWithNamespace[] = [];

  if (node == null) {
    return result;
  }

  const importUris = node.children
    .filter((child) => child.item.location.type === DependencyType.Import)
    .map((child) => child.item.location);

  importUris.forEach((importDef) => {
    const namespace = importDef.args[0];
    if (namespace == null) return;
    const itemTypeDoc = refs.get(importDef.location);
    if (itemTypeDoc == null) return;
    result.push({
      namespace,
      typeDoc: itemTypeDoc
    });
  });

  return result;
}

import { greyscriptMeta } from 'greyscript-meta';
import { SignatureDefinitionBaseType } from 'meta-utils';
import {
  TypeManager,
  Document as TypeDocument,
  ITypeStorage,
  IDocument,
  persistTypeInNativeFunction,
  MapType,
  EntityInfo
} from 'greybel-type-analyzer';

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
  container: greyscriptMeta,
  modifyTypeStorage: (document: IDocument, globalTypeStorage: ITypeStorage) => {
    const generalInterface = document.typeStorage.getTypeById(
      SignatureDefinitionBaseType.General
    );
    
    if (generalInterface.hasProperty('get_custom_object')) {
      return;
    }

    const gcoMap = MapType.createDefault(
      document.typeStorage,
      document,
      document.globals
    );
    const proxyGCOFn = persistTypeInNativeFunction(
      SignatureDefinitionBaseType.General,
      'get_custom_object',
      gcoMap,
      document,
      globalTypeStorage
    );

    generalInterface.setProperty('get_custom_object', new EntityInfo('get_custom_object', proxyGCOFn));
    document.typeStorage.memory.set('$$get_custom_object', gcoMap);
  }
});

export default typeManager;

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

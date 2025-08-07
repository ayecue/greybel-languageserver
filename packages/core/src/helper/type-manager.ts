import {
  Document as TypeDocument,
  EntityInfo,
  IDocument,
  ITypeStorage,
  ListType,
  MapType,
  persistTypeInNativeFunction,
  Type,
  TypeKind,
  TypeManager
} from 'greybel-type-analyzer';
import { greyscriptMeta } from 'greyscript-meta';
import { SignatureDefinitionBaseType } from 'meta-utils';

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

function injectParams(document: IDocument): void {
  if (document.globals.hasProperty('params')) {
    return;
  }

  document.globals.setProperty(
    'params',
    new ListType(
      document.typeStorage.generateId(TypeKind.ListType),
      Type.createBaseType(
        SignatureDefinitionBaseType.Number,
        document.typeStorage,
        document,
        document.globals
      ),
      document.typeStorage,
      document,
      document.globals
    )
  );
}

function injectGetCustomObject(
  document: IDocument,
  globalTypeStorage: ITypeStorage
): void {
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

  generalInterface.setProperty(
    'get_custom_object',
    new EntityInfo('get_custom_object', proxyGCOFn)
  );
  document.typeStorage.memory.set('$$get_custom_object', gcoMap);
}

const typeManager = new TypeManager({
  container: greyscriptMeta,
  modifyTypeStorage: (document: IDocument, globalTypeStorage: ITypeStorage) => {
    injectParams(document);
    injectGetCustomObject(document, globalTypeStorage);
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

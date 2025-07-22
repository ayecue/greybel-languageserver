import { ASTChunkGreyScript } from 'greyscript-core';
import { ASTBaseBlockWithScope, ASTIdentifier } from 'miniscript-core';
import { Document as TypeDocument } from 'miniscript-type-analyzer';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';

import {
  DependencyRawLocation,
  DependencyType,
  IActiveDocument,
  IContext,
  IDependencyLocation,
  parseDependencyLocation,
  parseDependencyRawLocation
} from '../../types';
import { DocumentURIBuilder } from './document-uri-builder';

export interface ActiveDocumentOptions {
  context: IContext;
  version: number;
  typeDocument: TypeDocument;
  textDocument: TextDocument;
  parsedPayload: ASTBaseBlockWithScope | null;
  errors: Error[];
}

export class ActiveDocument implements IActiveDocument {
  context: IContext;
  version: number;
  textDocument: TextDocument;
  typeDocument: TypeDocument;
  parsedPayload: ASTBaseBlockWithScope | null;
  errors: Error[];

  private dependencies?: IDependencyLocation[];

  constructor(options: ActiveDocumentOptions) {
    this.context = options.context;
    this.version = options.version;
    this.textDocument = options.textDocument;
    this.typeDocument = options.typeDocument;
    this.parsedPayload = options.parsedPayload;
    this.errors = options.errors;
  }

  getDirectory(): URI {
    return Utils.joinPath(URI.parse(this.textDocument.uri), '..');
  }

  async getNativeImportUris(
    workspaceFolderUri: URI = null
  ): Promise<DependencyRawLocation[]> {
    if (this.parsedPayload == null) {
      return [];
    }

    const rootChunk = this.parsedPayload as ASTChunkGreyScript;

    if (rootChunk.nativeImports.length === 0) {
      return [];
    }

    const rootPath = this.getDirectory();
    const builder = new DocumentURIBuilder(rootPath, workspaceFolderUri);
    const context = this.context;
    const imports = await Promise.all(
      rootChunk.nativeImports
        .filter((nativeImport) => nativeImport.directory && nativeImport.eval)
        .map(async (nativeImport) => {
          const path = await builder.getPathWithContext(
            nativeImport.directory,
            context
          );

          if (path == null) {
            return null;
          }

          return parseDependencyLocation({
            type: DependencyType.NativeImport,
            location: path
          });
        })
    );

    return imports.filter((path) => path != null);
  }

  async getImportUris(
    workspaceFolderUri: URI = null
  ): Promise<DependencyRawLocation[]> {
    if (this.parsedPayload == null) {
      return [];
    }

    const rootChunk = this.parsedPayload as ASTChunkGreyScript;

    if (rootChunk.imports.length === 0) {
      return [];
    }

    const rootPath = this.getDirectory();
    const context = this.context;
    const builder = new DocumentURIBuilder(rootPath, workspaceFolderUri);

    const paths = await Promise.all([
      ...rootChunk.imports
        .filter((nonNativeImport) => nonNativeImport.path)
        .map(async (nonNativeImport) => {
          const path = await builder.getPathWithContext(
            nonNativeImport.path,
            context
          );

          if (path == null) {
            return null;
          }

          return parseDependencyLocation({
            type: DependencyType.Import,
            location: path,
            args: [(nonNativeImport.name as ASTIdentifier)?.name]
          });
        })
    ]);

    return paths.filter((path) => path != null);
  }

  async getIncludeUris(
    workspaceFolderUri: URI = null
  ): Promise<DependencyRawLocation[]> {
    if (this.parsedPayload == null) {
      return [];
    }

    const rootChunk = this.parsedPayload as ASTChunkGreyScript;

    if (rootChunk.includes.length === 0) {
      return [];
    }

    const rootPath = this.getDirectory();
    const context = this.context;
    const builder = new DocumentURIBuilder(rootPath, workspaceFolderUri);

    const paths = await Promise.all([
      ...rootChunk.includes
        .filter((includeImport) => includeImport.path)
        .map(async (includeImport) => {
          const path = await builder.getPathWithContext(
            includeImport.path,
            context
          );

          if (path == null) {
            return null;
          }

          return parseDependencyLocation({
            type: DependencyType.Include,
            location: path
          });
        })
    ]);

    return paths.filter((path) => path != null);
  }

  async getDependencies(): Promise<IDependencyLocation[]> {
    if (this.parsedPayload == null) {
      return [];
    }

    if (this.dependencies) {
      return this.dependencies;
    }

    const workspacePathUri =
      await this.context.fs.getWorkspaceFolderUri(
        URI.parse(this.textDocument.uri)
      );
    const [nativeImports, imports, includes] = await Promise.all([
      this.getNativeImportUris(workspacePathUri),
      this.getImportUris(workspacePathUri),
      this.getIncludeUris(workspacePathUri)
    ]);
    const dependencies: Set<string> = new Set([
      ...nativeImports,
      ...imports,
      ...includes
    ]);

    this.dependencies = Array.from(dependencies).map(
      parseDependencyRawLocation
    );

    return this.dependencies;
  }
}
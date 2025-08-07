import type { EventEmitter } from "stream";
import type {
  createConnection,
  SemanticTokensBuilder
} from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { URI } from 'vscode-uri';
import type { LRUCache as LRU } from 'lru-cache';
import type { ASTBaseBlockWithScope } from 'miniscript-core';
import {
  Document as TypeDocument
} from 'greybel-type-analyzer';

export type LanguageId = 'greyscript';
export const LanguageId: LanguageId = 'greyscript';
export type ConfigurationNamespace = 'greybel';
export const ConfigurationNamespace: ConfigurationNamespace = 'greybel';
export const DefaultFileExtensions: string[] = ['gs', 'ms', 'src'];

export enum IndentationType {
  Tab = 'Tab',
  Whitespace = 'Whitespace'
}

export enum TypeAnalyzerStrategy {
  Dependency = 'Dependency',
  Workspace = 'Workspace'
}

export interface IConfigurationRequest {
  fileExtensions: string;
  formatter: boolean;
  autocomplete: boolean;
  hoverdocs: boolean;
  diagnostic: boolean;
  transpiler: {
    beautify: {
      keepParentheses: boolean;
      indentation: IndentationType;
      indentationSpaces: number;
    };
  };
  typeAnalyzer: {
    strategy: TypeAnalyzerStrategy;
    exclude: string;
  };
}

export interface IConfiguration {
  fileExtensions: string[];
  formatter: boolean;
  autocomplete: boolean;
  hoverdocs: boolean;
  diagnostic: boolean;
  transpiler: {
    beautify: {
      keepParentheses: boolean;
      indentation: IndentationType;
      indentationSpaces: number;
    };
  };
  typeAnalyzer: {
    strategy: TypeAnalyzerStrategy;
    exclude: string;
  };
}

export enum DependencyType {
  Root = 'root',
  Include = 'include',
  Import = 'import',
  NativeImport = 'native-import'
}

/**
 * Pattern: import:myVariable!./path/to/file.gs
 */
export type DependencyRawLocation = string;

export interface IDependencyLocation {
  type: DependencyType;
  location: string;
  args?: string[];
}

export function parseDependencyLocation(
  location: IDependencyLocation
): DependencyRawLocation {
  if (location.args && location.args.length > 0) {
    return `${location.type}:${location.args.join(':')}!${location.location}`;
  }

  return `${location.type}!${location.location}`;
}

export function parseDependencyRawLocation(
  rawLocation: DependencyRawLocation
): IDependencyLocation {
  const typeIndex = rawLocation.indexOf('!');
  const [type, ...args] = rawLocation.substring(0, typeIndex).split(':');
  const location = rawLocation.substring(typeIndex + 1);
  return { type: type as DependencyType, location, args };
}

export function getAllDependencyLocationsFromGraph(
  node: IActiveDocumentImportGraphNode,
  visited: Set<string> = new Set()
): IActiveDocument[] {
  const result: IActiveDocument[] = [];
  const queue: IActiveDocumentImportGraphNode[] = [...node.children];

  while (queue.length > 0) {
    const current = queue.pop();

    if (visited.has(current.item.document.textDocument.uri)) {
      continue;
    }

    visited.add(current.item.document.textDocument.uri);
    result.push(current.item.document);
    queue.push(...current.children);
  }

  return result;
}

export interface IActiveDocument {
  context: IContext;
  version: number;
  textDocument: TextDocument;
  typeDocument: TypeDocument;
  parsedPayload: ASTBaseBlockWithScope | null;
  errors: Error[];

  getDirectory(): URI;
  getDependencies(): Promise<IDependencyLocation[]>;
  getIncludeUris(): Promise<DependencyRawLocation[]>;
  getImportUris(): Promise<DependencyRawLocation[]>;
  getNativeImportUris(): Promise<DependencyRawLocation[]>;
}

export interface IActiveDocumentImport {
  document: IActiveDocument;
  location: IDependencyLocation;
}

export interface IActiveDocumentImportGraphNode {
  item: IActiveDocumentImport;
  children: IActiveDocumentImportGraphNode[];
}

export interface IDocumentManager extends EventEmitter {
  readonly documents: LRU<string, IActiveDocument>;
  readonly context: IContext;

  setContext(context: IContext)

  schedule(document: TextDocument): boolean;
  getOrOpen(target: string): Promise<IActiveDocument | null>;
  get(document: TextDocument): IActiveDocument;
  getLatest(document: TextDocument, timeout?: number): Promise<IActiveDocument>;
  clear(document: TextDocument): void;
}

export interface IDocumentMergerCache {
  createCacheKey(
    source: IActiveDocument,
    documents: IActiveDocument[]
  ): number;
  registerCacheKey(key: number, documentUri: string): void;
  flushCacheKey(documentUri: string): void;
  flushCache(): void;
}

export interface IDocumentMerger {
  readonly cache: IDocumentMergerCache;

  build(
    document: IActiveDocument,
    context: IContext
  ): Promise<TypeDocument>;
}

export interface IContext extends EventEmitter {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: IFileSystem;
  readonly documentManager: IDocumentManager;
  readonly documentMerger: IDocumentMerger;

  features: IContextFeatures;

  createSemanticTokensBuilder(): SemanticTokensBuilder;
  getConfiguration(): IConfiguration;
  listen(): Promise<void>;
}

export interface IFileSystem extends EventEmitter {
  getWorkspaceFolderUris(): Promise<URI[]>;
  getWorkspaceFolderUri(source: URI): Promise<URI | null>;
  getWorkspaceRelatedFiles(): Promise<URI[]>;
  getAllTextDocuments(): TextDocument[];
  findExistingPath(targetUri: string, ...altUris: string[]): Promise<string | null>;
  fetchTextDocument(targetUri: string): Promise<TextDocument | null>;
  getTextDocument(targetUri: string): Promise<TextDocument | null>
  readFile(targetUri: string): Promise<string>;
  listen(connection: ReturnType<typeof createConnection>);
}

export interface IContextFeatures {
  configuration: boolean;
  workspaceFolder: boolean;
}
import type { EventEmitter } from "stream";
import type {
  createConnection
} from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { URI } from 'vscode-uri';
import type LRU from 'lru-cache';
import type { ASTBaseBlockWithScope } from 'miniscript-core';
import {
  Document as TypeDocument
} from 'miniscript-type-analyzer';

export type LanguageId = 'greyscript';
export const LanguageId: LanguageId = 'greyscript';
export type ConfigurationNamespace = 'greybel';
export const ConfigurationNamespace: ConfigurationNamespace = 'greybel';

export enum IndentationType {
  Tab = 'Tab',
  Whitespace = 'Whitespace'
}

export interface IConfiguration {
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
}

export interface IActiveDocument {
  documentManager: IDocumentManager;
  content: string;
  textDocument: TextDocument;
  document: ASTBaseBlockWithScope | null;
  errors: Error[];

  getDirectory(): URI;
  getDependencies(): Promise<string[]>;
  getImports(nested?: boolean): Promise<IActiveDocument[]>
}

export interface IDocumentManager extends EventEmitter {
  readonly results: LRU<string, IActiveDocument>;
  readonly context: IContext;

  setContext(context: IContext)

  refresh(document: TextDocument): IActiveDocument;
  schedule(document: TextDocument): boolean;
  open(target: string): Promise<IActiveDocument | null>;
  get(document: TextDocument): IActiveDocument;
  getLatest(document: TextDocument, timeout?: number): Promise<IActiveDocument>;
  clear(document: TextDocument): void;
}

export interface IDocumentMerger {
  build(
    document: TextDocument,
    context: IContext
  ): Promise<TypeDocument>
}

export interface IContext extends EventEmitter {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: IFileSystem;
  readonly documentManager: IDocumentManager;
  readonly documentMerger: IDocumentMerger;

  features: IContextFeatures;

  getConfiguration(): IConfiguration;
  listen(): Promise<void>;
}

export interface IFileSystem extends EventEmitter {
  getWorkspaceFolderUris(): Promise<URI[]>;
  getWorkspaceFolderUri(source: URI): Promise<URI | null>;
  getAllTextDocuments(): TextDocument[];
  findExistingPath(...uris: string[]): Promise<string | null>;
  fetchTextDocument(targetUri: string): Promise<TextDocument | null>;
  getTextDocument(targetUri: string): Promise<TextDocument | null>
  readFile(targetUri: string): Promise<string>;
  listen(connection: ReturnType<typeof createConnection>);
}

export interface IContextFeatures {
  configuration: boolean;
  workspaceFolder: boolean;
}
import { EventEmitter } from "stream";
import {
  createConnection,
  TextDocuments
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

export interface IContext extends EventEmitter {
  readonly connection: ReturnType<typeof createConnection>;
  readonly textDocumentManager: TextDocuments<TextDocument>;

  getWorkspaceFolderUris(): URI[];
  findExistingPath(...uris: string[]): string;
  readFile(targetUri: string): string;
  listen(): Promise<void>;
}

export interface IContextFeatures {
  configuration: boolean;
  workspaceFolder: boolean;
  diagnosticRelatedInformation: boolean;
}
import { EventEmitter } from "stream";
import {
  createConnection,
  TextDocuments
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

export interface IConfiguration {
  formatter: boolean;
  autocomplete: boolean;
  hoverdocs: boolean;
  diagnostic: boolean;
  transpiler: {
    beautify: {
      keepParentheses: boolean;
      indentation: string;
      indentationSpaces: number;
    };
  };
}

export interface IContext extends EventEmitter {
  readonly connection: ReturnType<typeof createConnection>;

  getWorkspaceFolderUris(): Promise<URI[]>;
  findExistingPath(...uris: string[]): string;
  getTextDocument(targetUri: string): Promise<TextDocument>
  readFile(targetUri: string): Promise<string>;
  listen(): Promise<void>;
}

export interface IContextFeatures {
  configuration: boolean;
  workspaceFolder: boolean;
  diagnosticRelatedInformation: boolean;
}
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';
import { IContext } from '../../types';

export class DocumentURIBuilder {
  readonly workspaceFolderUri: URI | null;
  readonly rootPath: URI;

  static async fromTextDocument(
    textDocument: TextDocument,
    context: IContext
  ): Promise<DocumentURIBuilder> {
    const textDocumentUri = URI.parse(textDocument.uri);
    const workspaceFolderUri =
      await context.fs.getWorkspaceFolderUri(textDocumentUri);

    return new DocumentURIBuilder(
      Utils.joinPath(textDocumentUri, '..'),
      workspaceFolderUri
    );
  }

  constructor(rootPath: URI, workspaceFolderUri: URI = null) {
    this.workspaceFolderUri = workspaceFolderUri;
    this.rootPath = rootPath;
  }

  private getFromWorkspaceFolder(path: string): string {
    if (this.workspaceFolderUri == null) {
      console.warn(
        'Workspace folders are not available. Falling back to only relative paths.'
      );
      return Utils.joinPath(this.rootPath, path).toString();
    }

    return Utils.joinPath(this.workspaceFolderUri, path).toString();
  }

  private getFromRootPath(path: string): string {
    return Utils.joinPath(this.rootPath, path).toString();
  }

  private getAlternativePathsWithContext(
    path: string,
    context: IContext
  ): string[] {
    if (path.startsWith('/')) {
      return context.getConfiguration().fileExtensions.map((ext) => {
        return this.getFromWorkspaceFolder(`${path}.${ext}`);
      });
    }
    return context.getConfiguration().fileExtensions.map((ext) => {
      return this.getFromRootPath(`${path}.${ext}`);
    });
  }

  private getOriginalPath(path: string): string {
    if (path.startsWith('/')) {
      return this.getFromWorkspaceFolder(path);
    }
    return this.getFromRootPath(path);
  }

  async getPathWithContext(
    path: string,
    context: IContext
  ): Promise<string | null> {
    return context.fs.findExistingPath(
      this.getOriginalPath(path),
      ...this.getAlternativePathsWithContext(path, context)
    );
  }
}
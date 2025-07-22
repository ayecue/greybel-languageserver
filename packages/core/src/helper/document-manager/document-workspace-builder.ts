import { IActiveDocument, IContext, IDependencyLocation, IDocumentManager } from "../../types";

export class DocumentWorkspaceContext {
  readonly documents: IActiveDocument[];
  private refs: Map<string, IActiveDocument>;
  private dependencies: Map<string, IDependencyLocation[]>;
  
  constructor() {
    this.documents = [];
    this.refs = new Map<string, IActiveDocument>();
    this.dependencies = new Map<string, IDependencyLocation[]>();
  }

  async loadDependencies() {
    await Promise.all(this.documents.map(async (item) => {
      const depUris = await item.getDependencies();
      this.dependencies.set(item.textDocument.uri, depUris);
    }));
  }

  getDependencies(documentUri: string): IDependencyLocation[] {
    return this.dependencies.get(documentUri) || [];
  }

  getRefMap(): Map<string, IActiveDocument> {
    return this.refs;
  }

  getRef(uri: string): IActiveDocument | null {
    return this.refs.get(uri) || null;
  }

  setRef(uri: string, document: IActiveDocument): void {
    this.refs.set(uri, document);
    this.documents.push(document);
  }
}

export interface DocumentWorkspaceBuilderOptions {
  context: IContext;
}

export class DocumentWorkspaceBuilder {
  private context: IContext;

  constructor(options: DocumentWorkspaceBuilderOptions) {
    this.context = options.context;
  }

  async build() {
    const workspaceContext = new DocumentWorkspaceContext();
    const allFileUris = await this.context.fs.getWorkspaceRelatedFiles();
    
    await Promise.all(
      allFileUris.map(async (uri) => {
        const textDocument = await this.context.documentManager.getOrOpen(
          uri.toString()
        );
        workspaceContext.setRef(textDocument.textDocument.uri, textDocument);
        return textDocument;
      })
    );

    return workspaceContext;
  }
}
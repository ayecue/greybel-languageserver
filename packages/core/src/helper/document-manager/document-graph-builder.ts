import { DependencyType, IActiveDocument, IActiveDocumentImportGraphNode, IDocumentManager } from "../../types";

export interface DocumentGraphBuilderOptions {
  documentManager: IDocumentManager;
  entrypoint: IActiveDocument;
}

export class DocumentGraphBuilder {
  private documentManager: IDocumentManager;
  private entrypoint: IActiveDocument;
  private nodeCache: Map<string, IActiveDocumentImportGraphNode>;
  private pendingDocument: Map<string, Promise<IActiveDocument | null>>;

  constructor(options: DocumentGraphBuilderOptions) {
    this.documentManager = options.documentManager;
    this.entrypoint = options.entrypoint;
    this.nodeCache = new Map();
    this.pendingDocument = new Map();
  }

  private async getDocument(location: string): Promise<IActiveDocument | null> {
    if (this.pendingDocument.has(location)) {
      return this.pendingDocument.get(location);
    }

    const promise = this.documentManager.getOrOpen(location);
    this.pendingDocument.set(location, promise);
    const document = await promise;
    this.pendingDocument.delete(location);

    return document;
  }

  async build(): Promise<IActiveDocumentImportGraphNode> {
    const initialNode: IActiveDocumentImportGraphNode = {
      item: {
        document: this.entrypoint,
        location: {
          type: DependencyType.Root,
          location: this.entrypoint.textDocument.uri
        }
      },
      children: []
    };

    if (this.entrypoint.parsedPayload === null) {
      return initialNode;
    }

    this.nodeCache.set(this.entrypoint.textDocument.uri, initialNode);
    const traverse = async (
      rootResult: IActiveDocument,
      rootNode: IActiveDocumentImportGraphNode
    ) => {
      const dependencies = await rootResult.getDependencies();
    
      await Promise.all(dependencies.map(async (dependency) => {
        const existingNode = this.nodeCache.get(dependency.location);
    
        if (existingNode != null) {
          rootNode.children.push(existingNode);
          return;
        }

        const item = await this.getDocument(dependency.location);

        if (item === null) return;
    
        const childNode: IActiveDocumentImportGraphNode = {
          item: {
            document: item,
            location: dependency
          },
          children: []
        };

        this.nodeCache.set(dependency.location, childNode);
        rootNode.children.push(childNode);
    
        if (item.parsedPayload !== null) {
          await traverse(item, childNode);
        }
      }));
    };

    await traverse(this.entrypoint, initialNode);

    return initialNode;
  }
}
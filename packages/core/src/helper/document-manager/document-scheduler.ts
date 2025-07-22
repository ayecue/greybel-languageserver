import EventEmitter from 'events';
import { TextDocument } from 'vscode-languageserver-textdocument';

export interface ScheduledItem {
  document: TextDocument;
  createdAt: number;
}

export const PROCESSING_TIMEOUT = 50;

export class DocumentScheduler extends EventEmitter {
  private scheduledItems: Map<string, ScheduledItem>;
  private tickRef: () => void;
  private readonly processingTimeout: number;
  private _timer: NodeJS.Timeout | null;

  constructor(processingTimeout: number = PROCESSING_TIMEOUT) {
    super();
    this._timer = null;
    this.scheduledItems = new Map();
    this.tickRef = this.tick.bind(this);
    this.processingTimeout = processingTimeout;
  }

  private tick() {
    if (this.scheduledItems.size === 0) {
      this._timer = null;
      return;
    }

    const currentTime = Date.now();
    
    this.scheduledItems.forEach((item, uri) => {
      if (currentTime - item.createdAt > this.processingTimeout) {
        this.emit('process', item.document);
        this.scheduledItems.delete(uri);
      }
    });

    this._timer = setTimeout(this.tickRef, 0);
  }

  schedule(document: TextDocument): boolean {
    const fileUri = document.uri;

    if (this.scheduledItems.has(fileUri)) {
      return false;
    }

    this.scheduledItems.set(fileUri, {
      document,
      createdAt: Date.now()
    });

    if (this._timer === null) {
      this._timer = setTimeout(this.tickRef, 0);
    }

    return true;
  }

  isScheduled(document: TextDocument): boolean {
    return this.scheduledItems.has(document.uri);
  }

  cancel(document: TextDocument): boolean {
    return this.scheduledItems.delete(document.uri);
  }
}
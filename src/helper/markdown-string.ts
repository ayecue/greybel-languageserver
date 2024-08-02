export interface IMarkdownString {
  value: string;
  isTrusted?: boolean;
}

export class MarkdownString implements IMarkdownString {
  value: string;
  isTrusted?: boolean;
  sanitize: boolean = true;

  constructor(value: string = '') {
    this.value = value;
  }

  appendText(value: string): MarkdownString {
    // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
    this.value += value.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
    return this;
  }

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendCodeblock(langId: string, code: string): MarkdownString {
    this.value += '\n```';
    this.value += langId;
    this.value += '\n';
    this.value += code;
    this.value += '\n```\n';
    return this;
  }

  toString() {
    return this.value;
  }
}

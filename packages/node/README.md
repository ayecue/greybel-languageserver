# greybel-languageserver

[![greybel-languageserver](https://circleci.com/gh/ayecue/greybel-languageserver.svg?style=svg)](https://circleci.com/gh/ayecue/greybel-languageserver)

A [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) implementation for [GreyScript](https://github.com/ayecue/greybel-js) (the [Grey Hack](https://store.steampowered.com/app/605230/Grey_Hack/) flavour of MiniScript). Compatible with any editor that supports the LSP standard.

## Supported Providers

- **Completion** - auto-completion suggestions
- **Hover** - symbol information on hover
- **Color** - color information for syntax highlighting and theming
- **Definition** - navigate to a symbol's definition
- **Formatter** - automatic code formatting
- **Signature Help** - function/method signature display
- **Document Symbol** - list all symbols in a document
- **Workspace Symbol** - search symbols across the workspace
- **Diagnostic** - error, warning, and info diagnostics
- **Semantic Tokens** - enhanced token classification for highlighting

## Install

```bash
npm install -g greybel-languageserver
```

## Usage

```bash
greybel-languageserver --stdio
```

## Configuration

```ts
{
  fileExtensions: string; // default: "gs,ms,src"
  formatter: boolean; // default: true
  autocomplete: boolean; // default: true
  hoverdocs: boolean; // default: true
  diagnostic: boolean; // default: true
  strictMode: boolean; // default: false
  transpiler: {
    beautify: {
      keepParentheses: boolean; // default: true
      indentation: "Tab" | "Whitespace"; // default: "Tab"
      indentationSpaces: number; // default: 2
    };
  };
  typeAnalyzer: {
    strategy: "Dependency" | "Workspace"; // default: "Dependency"
    exclude?: string; // default: undefined
  };
}
```

## Editor Setup

Detailed setup instructions for each editor are in the [setup/](setup/) folder:

| Editor | Guide |
|--------|-------|
| VSCode | [setup/vscode.md](setup/vscode.md) |
| Sublime Text | [setup/sublime.md](setup/sublime.md) |
| IntelliJ | [setup/intellij.md](setup/intellij.md) |
| Neovim | [setup/neovim.md](setup/neovim.md) |
| Visual Studio | [setup/visual-studio.md](setup/visual-studio.md) |
| Zed | [setup/zed.md](setup/zed.md) |
| BBEdit | [setup/bbedit.md](setup/bbedit.md) |

Any other editor that follows the [LSP standard](https://microsoft.github.io/language-server-protocol/) should also work.

## How to Add Tooltips

Tooltips in `greybel-languageserver` can help provide additional context, such as method descriptions, to users. You can contribute your own tooltips by following this workflow:

1. Fork and create a pull request (PR) with your changes to the [greyscript-meta repository](https://github.com/ayecue/greyscript-meta), where the meta descriptions are stored.
2. Once your changes are merged, create a separate PR in this repository to update the version of `greybel-languageserver` to include the new meta descriptions.

Additionally, you can define method-specific tooltips directly in the code using comments:

```js
// @type Bar
// @property {string} virtualMoo
Bar = {}
Bar.moo = ""

// Hello world
// I am **bold**
// @description Alternative description
// @example test("title", 123)
// @param {string} test - The title of the book.
// @param {string|number} abc - The author of the book.
// @return {Bar} - Some info about return
Bar.test = function(test, abc)
  print "test"
  return self
end function

// @type Foo
Foo = new Bar
// @return {Foo}
Foo.New = function(message)
  result = new Foo
  return result
end function

myVar = Foo.New

myVar.test // shows defined signature of Bar.test on hover
myVar.virtualMoo // shows virtual property of type string on hover
```

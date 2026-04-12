# Sublime Text Setup

1. Install the [LSP Package](https://lsp.sublimetext.io/) from the Sublime Text Package Control.
2. Create the following LSP client configuration in your Sublime settings:

```json
{
  "show_diagnostics_panel_on_save": 0,
  "clients": {
    "greyscript": {
      "enabled": true,
      "command": ["greybel-languageserver", "--stdio"],
      "selector": "source.greyscript"
    }
  },
  "semantic_highlighting": true
}
```

3. Create a Sublime syntax file for GreyScript. The highlighting will be provided via the semantic provider, so there is no need to add additional patterns here:

```yaml
%YAML 1.2
---
name: greyscript
file_extensions:
  - src
scope: source.greyscript

contexts:
  main:
    - match: '.+'
      scope: text.greyscript
```

# Neovim Setup

Add the following configuration to your `init.lua`:

```lua
-- LSP configuration for greybel-languageserver
vim.lsp.config("greybel", {
  cmd = { "greybel-languageserver", "--stdio" },
  filetypes = { "greyscript" },
  root_dir = vim.fs.root(0, { ".git" }),
  settings = {
    greybel = {
      transpiler = {
        beautify = {
          indentation = "Whitespace",
          indentationSpaces = 4
        }
      }
    }
  }
})

-- Start the greybel LSP
vim.lsp.enable("greybel")

-- Create an autocmd for a new filetype and other buffer-local configurations
vim.api.nvim_create_autocmd({ "BufRead", "BufNewFile" }, {
  pattern = "*.src",
  callback = function()
    vim.bo.filetype = "greyscript"
    vim.keymap.set("n", "gq", vim.lsp.buf.format, { buffer = true })
  end,
})
```

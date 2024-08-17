const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

const build = async () => {
  try {
    await esbuild
      .build({
        entryPoints: ['./dist/index.js'],
        bundle: true,
        outfile: 'index.js',
        globalName: 'greybelLanguageserver',
        sourcemap: false,
        minify: false,
        minifyWhitespace: false,
        minifyIdentifiers: false,
        minifySyntax: false,
        target: 'es6',
        platform: 'browser',
        treeShaking: true,
        format: 'esm',
        external: [
          'vscode-languageserver/node',
        ],
        plugins: [
          polyfillNode({
            globals: false
          })
        ]
      });
  } catch (err) {
    console.error('Failed building project', { err });
    process.exit(1);
  }
};

build();
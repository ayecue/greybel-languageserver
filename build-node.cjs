const esbuild = require('esbuild');

const build = async () => {
  try {
    await esbuild
      .build({
        entryPoints: ['./dist/node.js'],
        bundle: true,
        outfile: 'node.js',
        globalName: 'greybelLanguageserver',
        sourcemap: false,
        minify: true,
        minifyWhitespace: true,
        minifyIdentifiers: true,
        minifySyntax: true,
        target: 'ESNext',
        platform: 'node',
        treeShaking: true,
        external: [
          'vscode-languageserver',
          'vscode-languageserver-textdocument'
        ]
      });
  } catch (err) {
    console.error('Failed building project', { err });
    process.exit(1);
  }
};

build();

const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

const build = async () => {
  try {
    await esbuild
      .build({
        entryPoints: ['./dist/index.js'],
        bundle: true,
        outfile: 'index.js',
        sourcemap: false,
        minify: false,
        minifyWhitespace: false,
        minifyIdentifiers: false,
        minifySyntax: false,
        target: 'esnext',
        platform: 'browser',
        treeShaking: true,
        format: 'esm',
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

const esbuild = require('esbuild');

const build = async () => {
  try {
    await Promise.all([
      esbuild.build({
        entryPoints: ['./mocks/client/extension.ts'],
        bundle: true,
        outfile: 'dist/extension.js',
        target: 'ESNext',
        platform: 'node',
        format: 'cjs',
        loader: {
          '.ts': 'ts'
        },
        external: [
          'vscode',
        ]
      }),
      esbuild.build({
        entryPoints: ['./mocks/server/index.ts'],
        bundle: true,
        outfile: 'dist/server.js',
        globalName: 'greybelLanguageserver',
        target: 'ESNext',
        platform: 'node',
        format: 'cjs',
        loader: {
          '.ts': 'ts'
        },
        external: [
          'vscode-languageserver/browser'
        ]
      }),
      esbuild.build({
        entryPoints: ['./tests/**/*.ts'],
        bundle: false,
        outdir: 'dist',
        platform: 'node',
        target: 'es6',
        format: 'cjs',
        sourcemap: true,
        loader: {
          '.ts': 'ts'
        }
      })
    ]);
  } catch (err) {
    console.error('Failed building project', { err });
    process.exit(1);
  }
};

build();

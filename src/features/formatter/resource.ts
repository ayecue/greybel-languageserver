import {
  ResourceHandler as TranspilerResourceHandler,
  ResourceProvider as TranspilerResourceProviderBase
} from 'greybel-transpiler';
import { URI, Utils } from 'vscode-uri';

import ctx from '../../context';

export class TranspilerResourceProvider extends TranspilerResourceProviderBase {
  getHandler(): TranspilerResourceHandler {
    return {
      getTargetRelativeTo: async (
        source: string,
        target: string
      ): Promise<string> => {
        const workspaceFolders = await ctx.getWorkspaceFolderUris();
        const base = target.startsWith('/')
          ? workspaceFolders[0]
          : Utils.joinPath(URI.parse(source), '..');
        const uri = Utils.joinPath(base, target);
        const uriAlt = Utils.joinPath(base, `${target}.src`);
        return await ctx.findExistingPath(uri.toString(), uriAlt.toString());
      },
      has: async (target: string): Promise<boolean> => {
        const result = await ctx.readFile(target);
        return !!result;
      },
      get: (target: string): Promise<string> => {
        return Promise.resolve(ctx.readFile(target));
      },
      resolve: (target: string): Promise<string> => {
        return Promise.resolve(target);
      }
    };
  }
}

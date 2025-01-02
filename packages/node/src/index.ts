import {
  activateAutocomplete,
  activateColor,
  activateDefinition,
  activateDiagnostic,
  activateFoldingRange,
  activateFormatter,
  activateHover,
  activateSemantic,
  activateSignature,
  activateSubscriptions,
  activateSymbol,
  IContext
} from 'greybel-languageserver-core';

import { NodeContext } from './context';

const context = new NodeContext();

context.on('ready', (ctx: IContext) => {
  activateAutocomplete(ctx);
  activateColor(ctx);
  activateDefinition(ctx);
  activateDiagnostic(ctx);
  activateFormatter(ctx);
  activateHover(ctx);
  activateSignature(ctx);
  activateSubscriptions(ctx);
  activateSymbol(ctx);
  activateSemantic(ctx);
  activateFoldingRange(ctx);
});

context.listen();

import { BrowserContext } from './context';
import {
  activateAutocomplete,
  activateColor,
  activateDefinition,
  activateDiagnostic,
  activateFormatter,
  activateHover,
  activateSignature,
  activateSubscriptions,
  activateSymbol,
  activateSemantic,
  activateFoldingRange,
  IContext
} from 'greybel-languageserver-core';

const context = new BrowserContext();

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
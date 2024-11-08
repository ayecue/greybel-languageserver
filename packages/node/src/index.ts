import { NodeContext } from './context';
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
  IContext
} from 'greybel-languageserver-core';

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
});

context.listen();
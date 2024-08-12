import { BrowserContext } from './context/browser';
import documentManager from './helper/document-manager';

import { activate as activateAutocomplete } from './features/autocomplete';
import { activate as activateColor } from './features/color';
import { activate as activateDefinition } from './features/definition';
import { activate as activateDiagnostic } from './features/diagnostic';
import { activate as activateFormatter } from './features/formatter';
import { activate as activateHover } from './features/hover';
import { activate as activateSignature } from './features/signature';
import { activate as activateSubscriptions } from './features/subscriptions';
import { activate as activateSymbol } from './features/symbol';

const context = new BrowserContext();

documentManager.setContext(context);

context.on('ready', (ctx) => {
  activateAutocomplete(ctx);
  activateColor(ctx);
  activateDefinition(ctx);
  activateDiagnostic(ctx);
  activateFormatter(ctx);
  activateHover(ctx);
  activateSignature(ctx);
  activateSubscriptions(ctx);
  activateSymbol(ctx);
});

context.listen();
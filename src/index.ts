import context from './context';
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

documentManager.setContext(context);

context.on('ready', () => {
  activateAutocomplete();
  activateColor();
  activateDefinition();
  activateDiagnostic();
  activateFormatter();
  activateHover();
  activateSignature();
  activateSubscriptions();
  activateSymbol();
});

context.listen();
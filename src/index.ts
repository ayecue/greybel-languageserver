import { activate as activateAutocomplete } from './features/autocomplete';
import { Context } from './context';
import documentManager from './helper/document-manager';

const context = new Context();

documentManager.setContext(context);

context.on('ready', (ctx) => {
  activateAutocomplete(ctx);
});

context.listen();
import { activate as activateAutocomplete } from './features/autocomplete';
import context from './context';
import documentManager from './helper/document-manager';

documentManager.setContext(context);

context.on('ready', () => {
  activateAutocomplete();
});

context.listen();
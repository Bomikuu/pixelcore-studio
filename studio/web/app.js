import { errorState } from './states.js';
const host = document.querySelector('#app');
let app,
  alive = true;
import('./studio.js')
  .then(({ mountStudio }) => {
    if (alive) app = mountStudio(host);
  })
  .catch((error) => {
    if (!alive) return;
    const state = errorState(document, {
      error,
      fullscreen: true,
      onRetry: () => location.reload(),
    });
    (host.shadowRoot || host).replaceChildren(state.element);
    state.focus();
  });
addEventListener(
  'pagehide',
  () => {
    alive = false;
    app?.destroy();
  },
  { once: true },
);

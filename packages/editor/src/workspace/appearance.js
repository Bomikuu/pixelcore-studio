import { applyTokens } from '../tokens.js';
export const appearanceKey = 'sitebuilder:appearance:v1';
export function createAppearance(element, { storage, initial, onChange = () => {} } = {}) {
  let stored;
  try {
    stored = storage?.getItem(appearanceKey);
  } catch {}
  let current = ['light', 'dark'].includes(initial)
    ? initial
    : ['light', 'dark'].includes(stored)
      ? stored
      : 'light';
  const previous = element.getAttribute('data-editor-appearance');
  const restoreTokens = applyTokens(element, current);
  const apply = () => {
    element.setAttribute('data-editor-appearance', current);
    onChange(current);
  };
  apply();
  return {
    get value() {
      return current;
    },
    set(value) {
      if (!['light', 'dark'].includes(value))
        throw new Error('Choose light or dark editor appearance.');
      current = value;
      applyTokens(element, current);
      apply();
      try {
        storage?.setItem(appearanceKey, current);
      } catch {}
    },
    destroy() {
      restoreTokens();
      previous === null
        ? element.removeAttribute('data-editor-appearance')
        : element.setAttribute('data-editor-appearance', previous);
    },
  };
}

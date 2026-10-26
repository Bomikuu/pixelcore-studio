import { fontRegistry } from '@sitebuilder/core';
const fonts = [
  ['Manrope', new URL('./assets/fonts/manrope.ttf', import.meta.url).href],
  ['Cormorant Garamond', new URL('./assets/fonts/cormorantgaramond.ttf', import.meta.url).href],
];
// Server-only consumers use their normal host font setup. Never emit local file paths.
export const fontCss = fonts
  .filter(([family]) =>
    fontRegistry.some((font) => font.family === family && font.kind === 'bundled'),
  )
  .filter(([, url]) => /^https?:/.test(url))
  .map(
    ([family, url]) =>
      `@font-face{font-family:'${family}';src:url('${url}') format('truetype');font-weight:100 900;font-display:swap}`,
  )
  .join('');

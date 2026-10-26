// The same names drive authoring and host font delivery. Legacy unbundled names remain readable.
export const fontRegistry = [
  { family: 'Manrope', kind: 'bundled', file: 'manrope.ttf' },
  { family: 'Cormorant Garamond', kind: 'bundled', file: 'cormorantgaramond.ttf' },
  ...['Georgia', 'Arial', 'Verdana', 'Trebuchet MS', 'system-ui'].map((family) => ({
    family,
    kind: 'system',
  })),
  ...['Newsreader', 'Bodoni Moda', 'Italiana'].map((family) => ({ family, kind: 'unavailable' })),
];
export function fontOptions(current) {
  return fontRegistry
    .filter((font) => font.kind !== 'unavailable' || font.family === current)
    .map((font) => ({
      value: font.family,
      label:
        font.family +
        (font.kind === 'system'
          ? ' · system font'
          : font.kind === 'unavailable'
            ? ' · unavailable; choose another'
            : ''),
      disabled: font.kind === 'unavailable',
    }));
}

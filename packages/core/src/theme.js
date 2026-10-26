import { effectiveStyle, headingSize } from './responsive.js';
export const colorRoles = [
  'background',
  'surface',
  'text',
  'muted',
  'primary',
  'onPrimary',
  'accent',
  'border',
];
const palette = (
  id,
  name,
  background,
  surface,
  text,
  muted,
  primary,
  onPrimary,
  accent,
  border,
) => ({
  id,
  name,
  colors: { background, surface, text, muted, primary, onPrimary, accent, border },
});
export const schemes = [
  palette(
    'clean',
    'Clean light',
    '#ffffff',
    '#f4f6f8',
    '#19252e',
    '#53616d',
    '#125b50',
    '#ffffff',
    '#ba5a30',
    '#d8dfe4',
  ),
  palette(
    'editorial',
    'Editorial dark',
    '#17191c',
    '#22262b',
    '#f5f3ee',
    '#b8bec7',
    '#dbbd84',
    '#202020',
    '#d6b68b',
    '#555b63',
  ),
  palette(
    'forest',
    'Forest',
    '#f4f7f0',
    '#e8eee2',
    '#193a28',
    '#4d6554',
    '#245839',
    '#ffffff',
    '#996126',
    '#c3cebe',
  ),
  palette(
    'ocean',
    'Ocean',
    '#f3f8fc',
    '#e5eff7',
    '#17334b',
    '#4e657b',
    '#175c91',
    '#ffffff',
    '#8a4d1f',
    '#bacfdf',
  ),
  palette(
    'warm',
    'Warm neutral',
    '#faf6ef',
    '#eee6da',
    '#3b3028',
    '#6d5d4d',
    '#824c31',
    '#ffffff',
    '#85612a',
    '#d5c9b9',
  ),
  palette(
    'contrast',
    'High contrast',
    '#ffffff',
    '#f2f2f2',
    '#000000',
    '#333333',
    '#000000',
    '#ffffff',
    '#0047b3',
    '#666666',
  ),
];
export const fonts = [
  'Manrope',
  'Newsreader',
  'Georgia',
  'Arial',
  'Verdana',
  'Trebuchet MS',
  'Bodoni Moda',
  'Cormorant Garamond',
  'Italiana',
  'system-ui',
];
export const defaultTheme = () => ({
  name: 'Clean light',
  colors: { ...schemes[0].colors },
  headingFont: 'Georgia',
  bodyFont: 'Manrope',
  baseSize: 16,
  scale: 1.25,
  radius: 4,
});
export function validateBrandKit(value) {
  if (!value || value.version !== 1) throw new Error('Brand kit must use version 1.');
  const kit = { version: 1, colors: {} };
  for (const [key, color] of Object.entries(value.colors || {})) {
    if (!colorRoles.includes(key) || !/^#[a-f\d]{6}$/i.test(color))
      throw new Error(`Invalid brand color: ${key}`);
    kit.colors[key] = color;
  }
  for (const key of ['headingFont', 'bodyFont'])
    if (value[key]) {
      if (!fonts.includes(value[key])) throw new Error(`Unsupported font: ${value[key]}`);
      kit[key] = value[key];
    }
  if (value.baseSize !== undefined) {
    if (!Number.isFinite(value.baseSize) || value.baseSize < 12 || value.baseSize > 28)
      throw new Error('Base font size must be 12–28.');
    kit.baseSize = value.baseSize;
  }
  if (value.logoAssetId) {
    if (typeof value.logoAssetId !== 'string' || value.logoAssetId.length > 160)
      throw new Error('Invalid logo asset.');
    kit.logoAssetId = value.logoAssetId;
  }
  return kit;
}
const rgb = (c) => {
  if (typeof c !== 'string' || !/^#[a-f\d]{6}([a-f\d]{2})?$/i.test(c)) return null;
  const a = c.length === 9 ? parseInt(c.slice(7), 16) / 255 : 1;
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).concat(a);
};
const lum = (v) =>
  v
    .slice(0, 3)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
export function checkContrast({
  foreground,
  background,
  fontSize = 16,
  fontWeight = 400,
  role = 'text',
}) {
  const fg = rgb(foreground),
    bg = rgb(background);
  const required =
    role === 'control' || fontSize >= 24 || (fontSize >= 56 / 3 && fontWeight >= 700) ? 3 : 4.5;
  if (!fg || !bg || bg[3] !== 1) return { ratio: null, required, status: 'needs-review' };
  const mixed = fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]));
  const a = lum(mixed),
    b = lum(bg);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return { ratio, required, status: ratio >= required ? 'pass' : 'fail' };
}
export function contrastFindings(document, { breakpoint = 'desktop' } = {}) {
  const findings = [],
    theme = document.theme;
  const visit = (n, inherited) => {
    const style = effectiveStyle(n, breakpoint);
    let background = inherited.background,
      foreground = inherited.foreground;
    if (style.backgroundColor && style.backgroundColor !== 'transparent')
      background = theme.colors[style.backgroundColor] || style.backgroundColor;
    if (style.background)
      background = style.background.type === 'solid' ? style.background.color : style.background;
    if (style.color) foreground = theme.colors[style.color] || style.color;
    if (n.type === 'button') {
      const buttonBg = style.background || style.backgroundColor || theme.colors.primary;
      background =
        buttonBg === 'transparent'
          ? inherited.background
          : buttonBg && typeof buttonBg === 'object'
            ? buttonBg.type === 'solid'
              ? buttonBg.color
              : buttonBg
            : theme.colors[buttonBg] || buttonBg;
      foreground = style.color ? foreground : theme.colors.onPrimary;
    }
    if (['text', 'heading', 'button'].includes(n.type) && style.display !== 'none') {
      const result = checkContrast({
        foreground,
        background,
        fontSize:
          style.fontSize ||
          (n.type === 'heading'
            ? headingSize(theme, n.props.level || 2)
            : (inherited.size || theme.baseSize) * (n.type === 'button' ? 0.9 : 1)),
        fontWeight: style.fontWeight || (n.type === 'heading' ? 500 : inherited.weight || 400),
      });
      if (result.status !== 'pass') findings.push({ nodeId: n.id, type: n.type, ...result });
    }
    for (const child of n.children || [])
      visit(child, {
        background,
        foreground,
        size: style.fontSize || inherited.size || theme.baseSize,
        weight: style.fontWeight || inherited.weight || 400,
      });
  };
  visit(document, { background: theme.colors.background, foreground: theme.colors.text });
  return findings;
}

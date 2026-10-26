import { defaultTheme } from './theme.js';
import { effectiveStyle } from './responsive.js';

// Presets expand to ordinary document styles; public pages need no editor runtime.
export const shadowValues = Object.freeze({
  none: 'none',
  soft: '0 4px 16px #00000014',
  lifted: '0 8px 28px #0000001f',
});
const preset = (id, label, description, style) => ({ id, label, description, style });
const edge = { borderWidth: 0, borderStyle: 'solid', borderColor: 'border', boxShadow: 'none' };
export function stylePresets(type, theme = defaultTheme()) {
  const button = {
    ...edge,
    borderColor: 'primary',
    backgroundColor: 'primary',
    color: 'onPrimary',
    borderRadius: 8,
    paddingTop: 12,
    paddingRight: 24,
    paddingBottom: 12,
    paddingLeft: 24,
    fontSize: theme.baseSize,
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: 0,
    textAlign: 'center',
  };
  const card = {
    ...edge,
    backgroundColor: 'background',
    color: 'text',
    borderRadius: 12,
    padding: 24,
  };
  const image = { ...edge, borderRadius: 0, padding: 0, overflow: 'hidden' };
  const text = { fontWeight: 400, lineHeight: 1.65, letterSpacing: 0 };
  if (type === 'button')
    return [
      preset('rounded', 'Rounded', 'A filled everyday button.', button),
      preset('pill', 'Pill', 'A filled button with fully rounded ends.', {
        ...button,
        borderRadius: 200,
      }),
      preset('outline', 'Outline', 'A clear background with a fine border.', {
        ...button,
        backgroundColor: 'transparent',
        color: 'primary',
        borderWidth: 1,
      }),
      preset('outline-pill', 'Outline pill', 'A rounded outline with a clear background.', {
        ...button,
        backgroundColor: 'transparent',
        color: 'primary',
        borderWidth: 1,
        borderRadius: 200,
      }),
      preset('soft', 'Soft', 'A quiet surface with readable text.', {
        ...button,
        backgroundColor: 'surface',
        color: 'text',
      }),
      preset('text-link', 'Text link', 'Text only, without a background or border.', {
        ...button,
        backgroundColor: 'transparent',
        color: 'primary',
        borderRadius: 0,
        paddingLeft: 0,
        paddingRight: 0,
      }),
    ];
  if (type === 'container')
    return [
      preset('plain', 'Plain', 'An open card without a frame.', {
        ...card,
        backgroundColor: 'transparent',
        borderRadius: 0,
        padding: 0,
      }),
      preset('bordered', 'Bordered', 'A fine border and comfortable spacing.', {
        ...card,
        borderWidth: 1,
      }),
      preset('elevated', 'Elevated', 'A soft shadow without an extra border.', {
        ...card,
        boxShadow: 'soft',
      }),
      preset('filled', 'Filled', 'A subtle surface to group related content.', {
        ...card,
        backgroundColor: 'surface',
      }),
    ];
  if (type === 'image')
    return [
      preset('natural', 'Natural', 'The image without a frame.', image),
      preset('rounded', 'Rounded', 'Soft corners around the image.', {
        ...image,
        borderRadius: 16,
      }),
      preset('framed', 'Framed', 'A fine border with space around the image.', {
        ...image,
        borderRadius: 12,
        borderWidth: 1,
        padding: 8,
      }),
    ];
  if (type === 'section')
    return [
      preset('clean', 'Clean', 'Your website background and text colors.', {
        backgroundColor: 'background',
        color: 'text',
      }),
      preset('soft', 'Soft', 'A subtle surface between sections.', {
        backgroundColor: 'surface',
        color: 'text',
      }),
      preset('brand', 'Brand', 'Your primary color with its paired text.', {
        backgroundColor: 'primary',
        color: 'onPrimary',
      }),
    ];
  if (type === 'columns')
    return [
      preset('two', 'Two columns', 'Two equal columns, stacked on phones.', {
        display: 'grid',
        gridColumns: 2,
        gap: 24,
      }),
      preset('three', 'Three columns', 'Three equal columns, stacked on phones.', {
        display: 'grid',
        gridColumns: 3,
        gap: 24,
      }),
      preset('stack', 'Vertical stack', 'One column with comfortable spacing.', {
        display: 'grid',
        gridColumns: 1,
        gap: 24,
      }),
    ];
  if (type === 'heading')
    return [
      preset('display', 'Display', 'A prominent headline for key sections.', {
        ...text,
        fontSize: Math.min(128, theme.baseSize * 3),
        fontWeight: 600,
        lineHeight: 1.12,
        letterSpacing: -0.025,
      }),
      preset('title', 'Title', 'A balanced section heading.', {
        ...text,
        fontSize: Math.min(128, theme.baseSize * 2),
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: -0.02,
      }),
      preset('subtitle', 'Subtitle', 'A compact heading for smaller groups.', {
        ...text,
        fontSize: Math.min(128, theme.baseSize * 1.25),
        fontWeight: 600,
        lineHeight: 1.35,
      }),
    ];
  if (type === 'text')
    return [
      preset('body', 'Body', 'Comfortable everyday reading.', {
        ...text,
        fontSize: theme.baseSize,
      }),
      preset('lead', 'Lead', 'A larger introduction or summary.', {
        ...text,
        fontSize: Math.min(128, theme.baseSize * 1.25),
        lineHeight: 1.5,
      }),
      preset('caption', 'Caption', 'Smaller supporting information.', {
        ...text,
        fontSize: Math.max(8, Math.round(theme.baseSize * 0.8125)),
        lineHeight: 1.5,
      }),
    ];
  return [];
}
export function presetStyleKeys(type) {
  const keys = new Set(stylePresets(type).flatMap((p) => Object.keys(p.style)));
  if (keys.has('backgroundColor')) keys.add('background');
  if (keys.has('padding') || keys.has('paddingTop'))
    for (const key of ['padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'])
      keys.add(key);
  return [...keys];
}
export function matchingStylePreset(node, theme, breakpoint = 'desktop') {
  const style = effectiveStyle(node, breakpoint);
  return (
    stylePresets(node.type, theme).find(
      (p) =>
        (!p.style.backgroundColor || !style.background) &&
        Object.entries(p.style).every(
          ([key, value]) => style[key] === value || (key === 'display' && style.display === 'none'),
        ) &&
        (p.style.padding === undefined ||
          ['Top', 'Right', 'Bottom', 'Left'].every(
            (side) => (style[`padding${side}`] ?? style.padding) === p.style.padding,
          )),
    )?.id || null
  );
}

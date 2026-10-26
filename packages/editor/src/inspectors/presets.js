import { stylePresets, matchingStylePreset } from '@sitebuilder/core';
import { el, button } from '../components/ui/index.js';

const names = {
  button: 'Button style',
  container: 'Card style',
  image: 'Image frame',
  section: 'Section style',
  columns: 'Column layout',
  heading: 'Heading style',
  text: 'Text style',
};
const screenName = (bp) => bp[0].toUpperCase() + bp.slice(1);
function illustration(d, type, preset, theme) {
  const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({
    viewBox: '0 0 140 76',
    'aria-hidden': 'true',
    focusable: 'false',
    class: 'style-preset-illustration',
  }))
    svg.setAttribute(key, value);
  const shape = (tag, attributes, text) => {
    const n = d.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attributes)) n.setAttribute(key, String(value));
    if (text) n.textContent = text;
    svg.append(n);
    return n;
  };
  const colors = theme.colors;
  const color = (value) => colors[value] || value;
  const style = preset.style;
  shape('rect', { x: 0, y: 0, width: 140, height: 76, fill: colors.background });
  if (type === 'button') {
    shape('rect', {
      x: 20,
      y: 23,
      width: 100,
      height: 30,
      rx: Math.min(15, style.borderRadius),
      fill: color(style.backgroundColor),
      stroke: color(style.borderColor),
      'stroke-width': style.borderWidth,
    });
    shape(
      'text',
      {
        x: 70,
        y: 42,
        'text-anchor': 'middle',
        fill: color(style.color),
        'font-size': 11,
        'font-weight': 600,
        'font-family': theme.bodyFont,
      },
      'Button',
    );
  } else if (type === 'container') {
    const card = shape('rect', {
      x: 22,
      y: 10,
      width: 96,
      height: 56,
      rx: style.borderRadius / 2,
      fill: color(style.backgroundColor),
      stroke: color(style.borderColor),
      'stroke-width': style.borderWidth,
    });
    if (style.boxShadow !== 'none') card.style.filter = 'drop-shadow(0 3px 4px #00000024)';
    shape('rect', { x: 33, y: 22, width: 32, height: 5, rx: 1, fill: colors.text });
    for (const [y, width] of [
      [35, 68],
      [44, 53],
      [53, 60],
    ])
      shape('rect', { x: 33, y, width, height: 3, rx: 1, fill: colors.muted, opacity: 0.65 });
  } else if (type === 'columns') {
    const count = style.gridColumns,
      width = (108 - (count - 1) * 6) / count;
    for (let i = 0; i < count; i++)
      shape('rect', {
        x: 16 + i * (width + 6),
        y: 17,
        width,
        height: 42,
        rx: 3,
        fill: colors.surface,
        stroke: colors.border,
        'stroke-width': 1,
      });
  } else if (type === 'section') {
    shape('rect', {
      x: 10,
      y: 10,
      width: 120,
      height: 56,
      rx: 2,
      fill: color(style.backgroundColor),
      stroke: colors.border,
      'stroke-width': 1,
    });
    shape('rect', { x: 27, y: 25, width: 66, height: 6, rx: 1, fill: color(style.color) });
    for (const [y, width] of [
      [39, 85],
      [48, 60],
    ])
      shape('rect', { x: 27, y, width, height: 3, rx: 1, fill: color(style.color), opacity: 0.65 });
  } else if (type === 'image') {
    shape('rect', {
      x: 24,
      y: 9,
      width: 92,
      height: 58,
      rx: style.borderRadius / 2,
      fill: colors.surface,
      stroke: colors.border,
      'stroke-width': style.borderWidth,
    });
    const inset = style.padding ? 6 : 0;
    shape('rect', {
      x: 26 + inset,
      y: 11 + inset,
      width: 88 - inset * 2,
      height: 54 - inset * 2,
      rx: Math.max(0, style.borderRadius / 2 - 2),
      fill: colors.border,
    });
    shape('path', { d: 'M56 43l10-11 17 17H53z', fill: colors.muted });
    shape('circle', { cx: 83, cy: 27, r: 4, fill: colors.muted });
  } else {
    const size = Math.max(12, Math.min(25, style.fontSize / 2));
    shape(
      'text',
      {
        x: 16,
        y: 39,
        fill: colors.text,
        'font-family': type === 'heading' ? theme.headingFont : theme.bodyFont,
        'font-size': size,
        'font-weight': style.fontWeight,
      },
      type === 'heading' ? 'Heading' : 'Your story',
    );
    if (type === 'text')
      for (const [y, width] of [
        [49, 106],
        [57, 80],
      ])
        shape('rect', { x: 16, y, width, height: 2, rx: 1, fill: colors.muted, opacity: 0.65 });
  }
  return svg;
}
export function renderStylePresets(ctx, node) {
  const { d, panel, history, breakpoint, command } = ctx;
  const theme = history.document.theme;
  const presets = stylePresets(node.type, theme);
  if (!presets.length) return;
  const selected = matchingStylePreset(node, theme, breakpoint);
  const group = el(d, 'section', { class: 'inspector-section style-presets' }, [
    el(d, 'h3', { text: names[node.type] }),
    el(d, 'p', {
      class: 'muted style-preset-current',
      text: selected
        ? `${presets.find((p) => p.id === selected).label} · ${screenName(breakpoint)}`
        : `Custom style · ${screenName(breakpoint)}`,
    }),
  ]);
  const choices = el(d, 'div', {
    class: 'style-preset-grid',
    role: 'group',
    'aria-label': names[node.type],
  });
  for (const preset of presets) {
    const choice = button(
      d,
      preset.label,
      () => {
        if (preset.id !== selected)
          command({ type: 'style-preset', id: node.id, preset: preset.id, breakpoint });
      },
      {
        class: 'ui-button style-preset-card',
        'data-style-preset': preset.id,
        'aria-label': `Apply ${preset.label} style`,
        'aria-pressed': preset.id === selected,
        tooltip: preset.description,
      },
    );
    choice.prepend(illustration(d, node.type, preset, theme));
    choices.append(choice);
  }
  group.append(
    choices,
    el(d, 'p', {
      class: 'muted style-preset-help',
      text: `Applies on ${screenName(breakpoint)}. ${breakpoint === 'desktop' ? 'Existing tablet and phone overrides stay in place.' : 'Other screen overrides stay in place.'}`,
    }),
  );
  panel.append(group);
}

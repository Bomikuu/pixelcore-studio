import { el, field, button } from '../components/ui/index.js';
import { effectiveStyle, styleOrigin } from '@sitebuilder/core';
export function renderResponsiveControls(ctx, node) {
  const { d, panel, breakpoint, command } = ctx;
  const effective = effectiveStyle(node, breakpoint);
  const section = el(d, 'section', { class: 'inspector-section' }, [
    el(d, 'h3', { text: `Responsive layout · ${breakpoint}` }),
    el(d, 'p', {
      class: 'muted',
      text:
        breakpoint === 'phone'
          ? 'Phone inherits tablet, then desktop. Reset a property to use its inherited value.'
          : breakpoint === 'tablet'
            ? 'Tablet inherits desktop. Overrides also apply to phone until changed there.'
            : 'Desktop sets the starting layout for every screen.',
    }),
  ]);
  function add(label, key, fallback, options = {}) {
    const own = breakpoint === 'desktop' ? node.style : node.responsive?.[breakpoint] || {};
    const origin = styleOrigin(node, key, breakpoint);
    const inherited =
      effective[key] ?? (key.startsWith('padding') ? effective.padding : undefined) ?? fallback;
    const group = el(d, 'div', { class: 'responsive-field' });
    group.append(
      field(
        d,
        label,
        inherited,
        (value) => command({ type: 'style', id: node.id, breakpoint, value: { [key]: value } }),
        options,
      ),
    );
    group.append(
      el(d, 'div', { class: 'responsive-field-meta' }, [
        el(d, 'span', {
          class: 'muted',
          text:
            origin === 'default'
              ? 'Theme / layout default'
              : origin === breakpoint
                ? `Set on ${breakpoint}`
                : `Inherited from ${origin}`,
        }),
        button(
          d,
          'Reset',
          () => command({ type: 'reset-style', id: node.id, breakpoint, property: key }),
          {
            'aria-label': `Reset ${label.toLowerCase()} on ${breakpoint}`,
            disabled: !Object.hasOwn(own || {}, key),
          },
        ),
      ]),
    );
    section.append(group);
  }
  add(
    'Visibility',
    'display',
    ['columns', 'repeater', 'gallery', 'products', 'services'].includes(node.type)
      ? 'grid'
      : 'block',
    {
      options: [
        { value: 'block', label: 'Block' },
        { value: 'grid', label: 'Grid' },
        { value: 'flex', label: 'Stack / flex' },
        { value: 'none', label: 'Hidden on this screen' },
      ],
    },
  );
  add('Spacing inside', 'padding', node.type === 'section' ? 64 : 0, {
    type: 'number',
    min: 0,
    max: 240,
  });
  for (const side of ['Top', 'Right', 'Bottom', 'Left'])
    add(`Padding ${side.toLowerCase()}`, `padding${side}`, 0, { type: 'number', min: 0, max: 240 });
  add('Gap', 'gap', 24, { type: 'number', min: 0, max: 160 });
  if (
    effective.display === 'grid' ||
    ['columns', 'repeater', 'products', 'services', 'gallery'].includes(node.type)
  )
    add('Columns', 'gridColumns', breakpoint === 'phone' ? 1 : node.type === 'columns' ? 2 : 3, {
      type: 'number',
      min: 1,
      max: 6,
    });
  add('Stack direction', 'flexDirection', 'column', {
    options: [
      { value: 'column', label: 'Vertical' },
      { value: 'row', label: 'Horizontal' },
    ],
  });
  add('Wrap items', 'flexWrap', 'wrap', {
    options: [
      { value: 'wrap', label: 'Wrap' },
      { value: 'nowrap', label: 'Single line' },
    ],
  });
  add('Align items', 'alignItems', 'stretch', { options: ['start', 'center', 'end', 'stretch'] });
  add('Distribute items', 'justifyContent', 'start', {
    options: [
      { value: 'start', label: 'Start' },
      { value: 'center', label: 'Center' },
      { value: 'end', label: 'End' },
      { value: 'space-between', label: 'Space between' },
    ],
  });
  add('Fluid width (%)', 'width', 100, { type: 'number', min: 1, max: 100 });
  add('Minimum width (px)', 'minWidth', 0, { type: 'number', min: 0, max: 2400 });
  add('Maximum width (px)', 'maxWidth', 1200, { type: 'number', min: 100, max: 2400 });
  add('Minimum height (px)', 'minHeight', 0, { type: 'number', min: 0, max: 1600 });
  if (node.type === 'spacer')
    add('Spacer height (px)', 'height', 40, { type: 'number', min: 0, max: 1600 });
  section.append(
    button(d, 'Reset this screen’s layout overrides', () =>
      command({ type: 'reset-style', id: node.id, breakpoint }),
    ),
  );
  panel.append(section);
}

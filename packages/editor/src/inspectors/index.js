import { renderPageSettings } from '../workspace/page-settings.js';
import { renderContentControls } from './content.js';
import { renderStylePresets } from './presets.js';
import { renderResponsiveControls } from '../workspace/responsive-controls.js';
import { renderBindings, renderCollectionControls } from '../workspace/data-panel.js';
import { el, button, field, modal } from '../components/ui/index.js';
import {
  findNode,
  resolveValue,
  fontOptions,
  schemes,
  checkContrast,
  validateBrandKit,
  contrastFindings,
  effectiveStyle,
  liveContentNodes,
} from '@sitebuilder/core';
const formatKey = (k) =>
  k.replace(/[A-Z]/g, (c) => ' ' + c.toLowerCase()).replace(/^./, (c) => c.toUpperCase());
export function renderInspector(ctx) {
  const {
    d,
    root,
    panel: originalPanel,
    history,
    selectedId,
    breakpoint,
    data,
    adapter,
    command,
    report,
  } = ctx;
  let panel = originalPanel;
  const previousAdvanced = panel.querySelector('[data-advanced-styling]');
  const advancedOpen = previousAdvanced?.open;
  const previousNode = previousAdvanced?.dataset.advancedStyling;
  panel.replaceChildren();
  const n = findNode(history.document, selectedId) || history.document;
  const theme = history.document.theme;
  if (n.type === 'global-section') {
    panel.append(
      el(d, 'h2', { class: 'panel-heading', text: n.props.name || 'Linked section' }),
      el(d, 'p', {
        class: 'muted',
        text: 'This section is linked to a shared source. Edit or publish the source from Shared sections, or detach a local copy.',
      }),
    );
    if (ctx.showGlobals) panel.append(button(d, 'Open shared sections', ctx.showGlobals));
    return;
  }
  if (adapter.workspace?.kind === 'layout' && ['header', 'footer'].includes(n.type)) {
    panel.append(
      el(d, 'h2', { class: 'panel-heading', text: `Global ${n.type}` }),
      el(d, 'p', {
        class: 'muted',
        text: 'Publishes across this site. Navigation, cart and account behavior stay in PixelCore.',
      }),
    );
    panel.append(
      field(
        d,
        'Variant',
        n.props.variant || (n.type === 'header' ? 'left' : 'columns'),
        (v) => command({ type: 'props', id: n.id, value: { variant: v } }),
        {
          options:
            n.type === 'header'
              ? adapter.workspace.headerVariants || ['left', 'center']
              : adapter.workspace.footerVariants || ['compact', 'columns', 'wedding'],
        },
      ),
    );
    for (const [key, label, fallback] of [
      ['backgroundColor', 'Background', theme.colors.background],
      ['color', 'Text color', theme.colors.text],
    ])
      panel.append(
        field(
          d,
          label,
          n.style[key] || fallback,
          (v) => command({ type: 'style', id: n.id, value: { [key]: v } }),
          { type: 'color' },
        ),
      );
    if (n.type === 'header')
      panel.append(
        field(
          d,
          'Outer spacing',
          n.style.padding || 0,
          (v) => command({ type: 'style', id: n.id, value: { padding: v } }),
          { type: 'number', min: 0, max: 80 },
        ),
      );
    if (adapter.openSource)
      panel.append(
        button(d, 'Edit navigation and site settings', () =>
          adapter.openSource({ source: 'site', path: 'settings' }),
        ),
      );
    return;
  }

  panel.append(
    el(d, 'h2', {
      class: 'panel-heading',
      text: n.type === 'page' ? 'Website settings' : n.props.name || formatKey(n.type),
    }),
  );
  const section = (title) => {
    const s = el(d, 'section', { class: 'inspector-section' }, [el(d, 'h3', { text: title })]);
    panel.append(s);
    return s;
  };
  const style = (key, value) =>
    command({ type: 'style', id: n.id, breakpoint, value: { [key]: value } });
  const effective = effectiveStyle(n, breakpoint);
  if (n.type === 'page') {
    const connectedBody = liveContentNodes(history.document, data).length > 0;
    const mode = field(
      d,
      'Content mode',
      history.document.mode,
      (value) => {
        if (!command({ type: 'document', value: { mode: value } }))
          mode.querySelector('select').value = history.document.mode;
      },
      {
        options: [
          { value: 'fixed', label: 'Fixed content', disabled: connectedBody },
          { value: 'live', label: 'Live data' },
        ],
      },
    );
    panel.append(
      field(d, 'Website title', history.document.title, (v) =>
        command({ type: 'document', value: { title: v } }),
      ),
      mode,
      el(d, 'p', {
        class: 'muted',
        text: connectedBody
          ? 'This body has live sections or connected fields. Remove or detach them to choose fixed content. Shared site branding stays connected in either mode.'
          : 'Fixed content is authored page copy. Shared branding, header and footer can update separately.',
      }),
    );
    panel.append(
      field(
        d,
        'Motion',
        history.document.motionDisabled ? 'off' : 'on',
        (v) => command({ type: 'document', value: { motionDisabled: v === 'off' } }),
        {
          options: [
            { value: 'on', label: 'Allow configured transitions' },
            { value: 'off', label: 'Disable all transitions' },
          ],
        },
      ),
    );
    renderPageSettings(ctx);
  } else {
    renderContentControls(ctx, n);
    if (n.type === 'component') {
      const descriptor = ctx.componentDescriptors?.get(
        `${n.props.componentId}:${n.props.componentVersion}`,
      );
      panel.append(
        el(d, 'p', {
          class: 'muted',
          text: `Catalog component · pinned to version ${n.props.componentVersion}. The live website loads it through the optional component runtime.`,
        }),
      );
      if (descriptor)
        for (const f of descriptor.manifest.fields) {
          const values = JSON.parse(n.props.componentSettings || '{}');
          panel.append(
            field(
              d,
              f.label,
              values[f.key] ?? f.default,
              (v) =>
                command({
                  type: 'props',
                  id: n.id,
                  value: { componentSettings: JSON.stringify({ ...values, [f.key]: v }) },
                }),
              {
                type: f.type === 'number' ? 'number' : f.type === 'color' ? 'color' : 'text',
                options: f.type === 'select' ? f.options : undefined,
                min: f.min,
                max: f.max,
              },
            ),
          );
        }
      else
        panel.append(
          el(d, 'p', {
            class: 'muted',
            text: 'Configure the optional catalog connection to edit this component’s declared settings.',
          }),
        );
    }
    if (['header', 'footer', 'widget'].includes(n.type)) {
      panel.append(
        field(
          d,
          'Layout variant',
          n.props.variant || 'inline',
          (v) => command({ type: 'props', id: n.id, value: { variant: v } }),
          {
            options:
              n.type === 'header'
                ? ['left', 'center', 'monogram']
                : n.type === 'footer'
                  ? ['compact', 'columns', 'wedding']
                  : ['inline', 'split', 'cta'],
          },
        ),
      );
      if (n.type === 'widget') {
        panel.append(
          el(d, 'p', {
            class: 'inline-feedback',
            text:
              n.props.widgetId === 'pixelcore.event-rsvp'
                ? 'Connected to the existing invitation and RSVP settings. Guest responses are never sent from this editor.'
                : 'Connected to approved event information.',
          }),
        );
        if (adapter.openSource)
          panel.append(
            button(d, 'Edit source settings', () =>
              adapter.openSource({ source: 'event', path: 'settings' }),
            ),
          );
      }
    }
    if (['heading', 'text', 'button'].includes(n.type)) {
      const connected = n.props.text && typeof n.props.text === 'object';
      if (connected) {
        panel.append(
          el(d, 'p', {
            class: 'inline-feedback',
            text: `Connected to ${n.props.text.source}.${n.props.text.path}`,
          }),
          el(d, 'p', {
            class: 'muted',
            text:
              n.props.text.source === 'item'
                ? 'Each card uses its own record. Manage this connection below.'
                : String(resolveValue(n.props.text, data) ?? 'Connection unavailable'),
          }),
        );
      } else
        panel.append(
          field(
            d,
            'Text',
            n.props.text || '',
            (v) => command({ type: 'text', id: n.id, value: v }),
            { type: 'textarea' },
          ),
        );
      if (n.type !== 'button' && !adapter.dataSources?.length && adapter.sources?.length) {
        panel.append(
          field(
            d,
            'Connect to system data',
            '',
            (v) => {
              if (v) {
                const [source, ...path] = v.split('.');
                command({
                  type: 'props',
                  id: n.id,
                  value: { text: { source, path: path.join('.') } },
                });
              }
            },
            {
              options: [
                { value: '', label: 'Choose a source' },
                ...adapter.sources.map((s) => ({ value: s.value, label: s.label })),
              ],
            },
          ),
        );
      }
    }
    if (n.type === 'heading')
      panel.append(
        field(
          d,
          'Heading level',
          n.props.level || 2,
          (v) => command({ type: 'props', id: n.id, value: { level: Number(v) } }),
          { options: [1, 2, 3, 4, 5, 6].map((x) => ({ value: String(x), label: `Heading ${x}` })) },
        ),
      );
    if (n.type === 'button' && typeof n.props.href !== 'object')
      panel.append(
        field(d, 'Link destination', n.props.href || '', (v) =>
          command({ type: 'props', id: n.id, value: { href: v } }),
        ),
      );
    if (['section', 'container', 'columns'].includes(n.type))
      panel.append(
        field(d, 'Layer name', n.props.name || '', (v) =>
          command({ type: 'props', id: n.id, value: { name: v } }),
        ),
      );
    if (['image', 'video'].includes(n.type)) {
      if (typeof n.props.assetId !== 'object')
        panel.append(
          field(
            d,
            n.type === 'video' ? 'Video' : 'Image',
            n.props.assetId || '',
            (v) => command({ type: 'props', id: n.id, value: { assetId: v } }),
            {
              options: [
                { value: '', label: 'Choose image' },
                ...Object.entries(data.assets || {})
                  .filter(([, a]) => (n.type === 'video' ? a.type === 'video' : a.type !== 'video'))
                  .map(([id, a]) => ({
                    value: id,
                    label: a.alt || a.name || id,
                  })),
              ],
            },
          ),
        );
      if (typeof n.props.alt !== 'object')
        panel.append(
          field(d, 'Alternative text', n.props.alt || '', (v) =>
            command({ type: 'props', id: n.id, value: { alt: v } }),
          ),
        );
      panel.append(
        field(d, 'Caption', n.props.caption || '', (v) =>
          command({ type: 'props', id: n.id, value: { caption: v } }),
        ),
      );
    }
    if (n.type === 'video')
      panel.append(
        field(
          d,
          'Poster image',
          n.props.posterId || '',
          (v) => command({ type: 'props', id: n.id, value: { posterId: v } }),
          {
            options: [
              { value: '', label: 'No poster' },
              ...Object.entries(data.assets || {})
                .filter(([, a]) => a.type !== 'video')
                .map(([id, a]) => ({ value: id, label: a.alt || id })),
            ],
          },
        ),
      );
    if (n.type === 'gallery') {
      panel.append(
        field(
          d,
          'Add an image',
          '',
          (value) => {
            if (value && !(n.props.assetIds || []).includes(value))
              command({
                type: 'props',
                id: n.id,
                value: { assetIds: [...(n.props.assetIds || []), value] },
              });
          },
          {
            options: [
              { value: '', label: 'Choose image' },
              ...Object.entries(data.assets || {})
                .filter(([, a]) => a.type !== 'video')
                .map(([id, a]) => ({ value: id, label: a.alt || id })),
            ],
          },
        ),
      );
      for (const [i, id] of (n.props.assetIds || []).entries())
        panel.append(
          button(d, `Remove ${data.assets?.[id]?.alt || `image ${i + 1}`}`, () =>
            command({
              type: 'props',
              id: n.id,
              value: { assetIds: n.props.assetIds.filter((_, j) => j !== i) },
            }),
          ),
        );
      panel.append(
        field(
          d,
          'Gallery layout',
          n.props.variant === 'logos' ? 'logos' : 'grid',
          (v) => command({ type: 'props', id: n.id, value: { variant: v } }),
          { options: ['grid', 'logos'] },
        ),
      );
    }
    if (['products', 'services', 'event-schedule'].includes(n.type))
      panel.append(
        field(
          d,
          'Item limit',
          n.props.limit || 6,
          (v) => command({ type: 'props', id: n.id, value: { limit: v } }),
          { type: 'number', min: 1, max: 50 },
        ),
        field(d, 'Data source', n.props.source || n.type, (v) =>
          command({ type: 'props', id: n.id, value: { source: v } }),
        ),
      );
    renderStylePresets(ctx, n);
    renderBindings(ctx, n);
    if (n.type === 'repeater') renderCollectionControls(ctx, n);
    const advanced = el(
      d,
      'details',
      { class: 'advanced-styling', 'data-advanced-styling': n.id },
      [
        el(d, 'summary', { text: 'Advanced styling' }),
        el(d, 'p', {
          class: 'muted advanced-help',
          text: 'Fine-tune spacing, borders, type and effects. These changes can create a custom style.',
        }),
      ],
    );
    advanced.open = previousNode === n.id && Boolean(advancedOpen);
    panel.append(advanced);
    panel = advanced;
    renderResponsiveControls({ ...ctx, panel }, n);
    const edges = section('Shape & border');
    edges.append(
      field(
        d,
        'Corner radius',
        effective.borderRadius ?? (n.type === 'button' ? theme.radius : 0),
        (v) =>
          command({
            type: 'style',
            id: n.id,
            breakpoint,
            value: { borderRadius: v, ...(n.type === 'image' ? { overflow: 'hidden' } : {}) },
          }),
        {
          type: 'number',
          min: 0,
          max: 200,
        },
      ),
      field(
        d,
        'Border width',
        effective.borderWidth ?? 0,
        (v) =>
          command({
            type: 'style',
            id: n.id,
            breakpoint,
            value: {
              borderWidth: v,
              borderStyle: effective.borderStyle || 'solid',
              borderColor: effective.borderColor || 'border',
            },
          }),
        {
          type: 'number',
          min: 0,
          max: 12,
        },
      ),
      field(d, 'Border style', effective.borderStyle || 'solid', (v) => style('borderStyle', v), {
        options: ['solid', 'dashed', 'none'],
      }),
      field(
        d,
        'Border color',
        theme.colors[effective.borderColor] ||
          (effective.borderColor === 'transparent' ? theme.colors.border : effective.borderColor) ||
          theme.colors.border,
        (v) => style('borderColor', v),
        { type: 'color' },
      ),
      field(d, 'Shadow', effective.boxShadow || 'none', (v) => style('boxShadow', v), {
        options: [
          { value: 'none', label: 'None' },
          { value: 'soft', label: 'Soft' },
          { value: 'lifted', label: 'Lifted' },
        ],
      }),
    );
    if (['heading', 'text', 'button'].includes(n.type)) {
      const type = section('Typography');
      type.append(
        el(d, 'p', {
          class: 'muted',
          text: `${n.type === 'heading' ? 'Primary' : 'Secondary'} font · ${n.type === 'heading' ? theme.headingFont : theme.bodyFont}. Set globally in Theme & branding.`,
        }),
        field(
          d,
          'Font size',
          effective.fontSize || (n.type === 'heading' ? 48 : theme.baseSize),
          (v) => style('fontSize', v),
          { type: 'number', min: 8, max: 128 },
        ),
        field(d, 'Weight', effective.fontWeight || 400, (v) => style('fontWeight', Number(v)), {
          options: [400, 500, 600, 700, 800].map((x) => ({ value: String(x), label: String(x) })),
        }),
        field(d, 'Line height', effective.lineHeight || 1.5, (v) => style('lineHeight', v), {
          type: 'number',
          min: 0.8,
          max: 3,
          step: 0.1,
        }),
        field(
          d,
          'Letter spacing (em)',
          effective.letterSpacing || 0,
          (v) => style('letterSpacing', v),
          { type: 'number', min: -0.04, max: 0.3, step: 0.01 },
        ),
        field(d, 'Alignment', effective.textAlign || 'left', (v) => style('textAlign', v), {
          options: ['left', 'center', 'right'],
        }),
      );
      const foreground = theme.colors[effective.color] || effective.color || theme.colors.text;
      type.append(field(d, 'Text color', foreground, (v) => style('color', v), { type: 'color' }));
      const bg = n.style.background || effective.backgroundColor || theme.colors.background;
      const result = contrastFindings(history.document, { breakpoint }).find(
        (f) => f.nodeId === n.id,
      ) || { ratio: null, required: 4.5, status: 'pass' };
      type.append(
        el(d, 'p', {
          class: `inline-feedback ${result.status === 'fail' ? 'error' : ''}`,
          text: result.ratio
            ? `Contrast ${result.ratio.toFixed(2)}:1 · ${result.status === 'pass' ? 'Pass' : 'Needs attention'} (requires ${result.required}:1)`
            : result.status === 'pass'
              ? 'Contrast passes for the inherited colors.'
              : 'Contrast needs review against this background.',
        }),
      );
      if (result.status === 'fail')
        type.append(
          button(d, 'Use high-contrast text', () => {
            const back = theme.colors[bg] || bg;
            const black = checkContrast({ foreground: '#000000', background: back });
            const white = checkContrast({ foreground: '#ffffff', background: back });
            style('color', (black.ratio || 0) > (white.ratio || 0) ? '#000000' : '#ffffff');
          }),
        );
    }
    const background = section('Background');
    const bg = effective.background || {
      type: effective.backgroundColor === 'transparent' ? 'transparent' : 'solid',
      color:
        theme.colors[effective.backgroundColor] ||
        effective.backgroundColor ||
        theme.colors.background,
    };
    const setBg = (value) => style('background', { ...bg, ...value });
    background.append(
      field(
        d,
        'Background type',
        bg.type,
        (v) =>
          v === 'transparent'
            ? style('backgroundColor', 'transparent')
            : style(
                'background',
                v === 'gradient'
                  ? { type: v, from: theme.colors.surface, to: theme.colors.background, angle: 135 }
                  : { type: v, color: theme.colors.background },
              ),
        {
          options:
            breakpoint === 'desktop'
              ? ['transparent', 'solid', 'gradient', 'image', 'video']
              : [
                  'transparent',
                  'solid',
                  'gradient',
                  'image',
                  ...(bg.type === 'video'
                    ? [{ value: 'video', label: 'Video inherited from Desktop', disabled: true }]
                    : []),
                ],
        },
      ),
    );
    if (breakpoint !== 'desktop' && bg.type === 'video')
      background.append(
        el(d, 'p', {
          class: 'muted',
          text: 'Configure video and its poster on Desktop. Choose a solid or image background here for a device-specific fallback.',
        }),
      );
    if (bg.type === 'solid')
      background.append(
        field(
          d,
          'Background color',
          bg.color || theme.colors.background,
          (v) => setBg({ color: v }),
          { type: 'color' },
        ),
      );
    if (bg.type === 'gradient')
      background.append(
        field(d, 'Start color', bg.from || theme.colors.surface, (v) => setBg({ from: v }), {
          type: 'color',
        }),
        field(d, 'End color', bg.to || theme.colors.background, (v) => setBg({ to: v }), {
          type: 'color',
        }),
        field(d, 'Angle', bg.angle || 135, (v) => setBg({ angle: v }), {
          type: 'number',
          min: 0,
          max: 360,
        }),
      );
    if (bg.type === 'image' || (bg.type === 'video' && breakpoint === 'desktop')) {
      const opts = [
        { value: '', label: 'Choose approved asset' },
        ...Object.entries(data.assets || {}).map(([id, a]) => ({ value: id, label: a.alt || id })),
      ];
      background.append(
        field(d, 'Media', bg.assetId || '', (v) => setBg({ assetId: v }), { options: opts }),
      );
      if (bg.type === 'video')
        background.append(
          field(d, 'Poster image', bg.posterId || '', (v) => setBg({ posterId: v }), {
            options: opts,
          }),
        );
      if (bg.type === 'image')
        background.append(
          field(d, 'Focal point', bg.focal || '50% 50%', (v) => setBg({ focal: v })),
          field(d, 'Overlay color', bg.overlay || '#000000', (v) => setBg({ overlay: v }), {
            type: 'color',
          }),
          field(d, 'Overlay opacity', bg.opacity || 0, (v) => setBg({ opacity: v }), {
            type: 'number',
            min: 0,
            max: 1,
            step: 0.05,
          }),
        );
    }
    if (breakpoint !== 'desktop') {
      panel.append(
        el(d, 'p', {
          class: 'muted',
          text: 'Transitions and free positioning are configured on Desktop. They respect reduced motion and mobile normal flow.',
        }),
      );
      return;
    }
    const motion = section('Transition');
    const m = effective.motion || { preset: 'none', duration: 400, delay: 0 };
    const setMotion = (v) => style('motion', { ...m, ...v });
    motion.append(
      field(d, 'Trigger', m.trigger || 'entrance', (v) => setMotion({ trigger: v }), {
        options: [
          { value: 'entrance', label: 'When the page opens' },
          { value: 'hover', label: 'On hover' },
          { value: 'section', label: 'When the section enters view' },
        ],
      }),
      field(d, 'Effect', m.preset, (v) => setMotion({ preset: v }), {
        options: ['none', 'fade', 'rise', 'slide', 'scale'],
      }),
      field(d, 'Easing', m.easing || 'ease-out', (v) => setMotion({ easing: v }), {
        options: ['ease-out', 'ease-in-out', 'linear', 'cubic-bezier(0.16,1,0.3,1)'],
      }),
      field(d, 'Duration (ms)', m.duration, (v) => setMotion({ duration: v }), {
        type: 'number',
        min: 100,
        max: 1200,
        step: 50,
      }),
      field(d, 'Delay (ms)', m.delay, (v) => setMotion({ delay: v }), {
        type: 'number',
        min: 0,
        max: 1500,
        step: 50,
      }),
      el(d, 'p', { class: 'muted', text: 'Transitions respect reduced-motion preferences.' }),
    );
    if (['section', 'container'].includes(n.type)) {
      const free = section('Free-form section');
      free.append(
        button(
          d,
          'Enable free positioning',
          async () => {
            try {
              const module = await import('@sitebuilder/freeform');
              command(module.enableSection(n.id));
            } catch (e) {
              report(e.message);
            }
          },
          { disabled: !ctx.enableFreeform },
        ),
        el(d, 'p', {
          class: 'muted',
          text: ctx.enableFreeform
            ? 'Position children inside this section; mobile keeps normal flow.'
            : 'Optional capability. Enable after recording browser performance and responsive checks.',
        }),
      );
    }
    if (effective.freeform) {
      const free = section('Position and size');
      for (const key of ['x', 'y', 'width', 'height', 'z'])
        free.append(
          field(
            d,
            formatKey(key),
            effective.freeform[key],
            (v) => style('freeform', { ...effective.freeform, [key]: v }),
            { type: 'number', min: 0, max: 1600 },
          ),
        );
    }
  }
  if (n.type === 'page' && ctx.showBrand)
    panel.append(button(d, 'Theme & branding', ctx.showBrand, { icon: 'theme' }));
}
function renderThemeSettings(ctx) {
  const { d, panel, history, command } = ctx;
  const theme = history.document.theme;
  const global = el(d, 'section', { class: 'inspector-section' }, [
    el(d, 'h3', { text: 'Site-wide typography & colors' }),
    el(d, 'p', {
      class: 'muted',
      text: 'Primary is used for headings; secondary for body text and controls. Font families apply across this website, including every breakpoint. Elements cannot override them.',
    }),
  ]);
  global.append(
    el(d, 'p', {
      class: 'muted',
      text: 'Manrope and Cormorant Garamond are bundled. System fonts depend on your device; unavailable legacy fonts need replacement.',
    }),
  );
  panel.append(global);
  global.append(
    field(
      d,
      'Primary font (headings)',
      theme.headingFont,
      (v) => command({ type: 'theme', value: { headingFont: v } }),
      { options: fontOptions(theme.headingFont) },
    ),
    field(
      d,
      'Secondary font (body)',
      theme.bodyFont,
      (v) => command({ type: 'theme', value: { bodyFont: v } }),
      { options: fontOptions(theme.bodyFont) },
    ),
    field(d, 'Type scale', theme.scale, (v) => command({ type: 'theme', value: { scale: v } }), {
      type: 'number',
      min: 1,
      max: 2,
      step: 0.05,
    }),
    field(
      d,
      'Base font size',
      theme.baseSize,
      (v) => command({ type: 'theme', value: { baseSize: v } }),
      { type: 'number', min: 12, max: 28 },
    ),
  );
  for (const role of [
    'background',
    'surface',
    'text',
    'muted',
    'primary',
    'onPrimary',
    'accent',
    'border',
  ])
    global.append(
      field(
        d,
        formatKey(role),
        theme.colors[role],
        (v) => command({ type: 'theme', value: { colors: { [role]: v } } }),
        { type: 'color' },
      ),
    );
}
export function renderBrandPanel(ctx) {
  const { d, panel, root, history, command, adapter, report } = ctx;
  panel.append(
    el(d, 'h2', { class: 'panel-heading', text: 'Brand & style' }),
    el(d, 'p', {
      class: 'panel-description',
      text: 'Apply a scheme, then make it yours. Changes stay in this website draft.',
    }),
  );
  const grid = el(d, 'div', { class: 'palette-grid' });
  for (const s of schemes) {
    const b = button(
      d,
      '',
      () => command({ type: 'theme', value: { name: s.name, colors: s.colors } }),
      { 'aria-label': s.name, 'aria-pressed': history.document.theme.name === s.name },
    );
    const colors = el(d, 'div', { class: 'palette-colors' });
    for (const c of [s.colors.background, s.colors.primary, s.colors.accent]) {
      const swatch = el(d, 'span');
      swatch.style.background = c;
      colors.append(swatch);
    }
    b.append(colors, el(d, 'span', { text: s.name }));
    grid.append(b);
  }
  panel.append(grid);
  renderThemeSettings(ctx);
  const showImport = (kit) => {
    const safe = validateBrandKit(kit);
    const content = el(d, 'div', {}, [
      el(d, 'p', {
        text: 'Preview brand import. This updates the website draft; global business branding stays unchanged.',
      }),
      el(d, 'pre', { text: JSON.stringify(safe, null, 2), class: 'review-link' }),
    ]);
    modal(
      root,
      'Import branding',
      content,
      () => {
        const { version, ...value } = safe;
        command({ type: 'theme', value });
      },
      { confirmLabel: 'Apply to draft' },
    );
  };
  if (adapter.getBrandKit)
    panel.append(
      button(d, 'Import system branding', async () => {
        try {
          const kit = await adapter.getBrandKit();
          if (ctx.isActive?.() === false) return;
          showImport(kit);
        } catch (e) {
          report(e.message);
        }
      }),
    );
  const importArea = field(
    d,
    'Brand kit JSON',
    ctx.state?.brandJSON || '',
    (value) => {
      if (ctx.state) ctx.state.brandJSON = value;
    },
    { type: 'textarea' },
  );
  importArea.querySelector('textarea').addEventListener('input', (e) => {
    if (ctx.state) ctx.state.brandJSON = e.target.value;
  });
  panel.append(
    importArea,
    button(d, 'Preview JSON import', () => {
      try {
        showImport(JSON.parse(importArea.querySelector('textarea').value));
      } catch (e) {
        report(e.message);
      }
    }),
  );
  panel.append(
    button(d, 'Export brand kit', () => {
      const kit = {
        version: 1,
        colors: history.document.theme.colors,
        headingFont: history.document.theme.headingFont,
        bodyFont: history.document.theme.bodyFont,
        baseSize: history.document.theme.baseSize,
      };
      ctx.download('brand-kit.json', kit);
    }),
  );
}

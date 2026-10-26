import { validatePageSettings } from './page-settings.js';
import { validateAnalytics } from './analytics.js';
import { validateComponentProps } from './components.js';
import { validateContentProps } from './content.js';
import { defaultTheme, colorRoles, fonts } from './theme.js';
export const nodeTypes = [
  'component',
  'accordion',
  'tabs',
  'video',
  'repeater',
  'global-section',
  'header',
  'footer',
  'widget',
  'spacer',
  'section',
  'container',
  'columns',
  'heading',
  'text',
  'image',
  'button',
  'divider',
  'gallery',
  'products',
  'services',
  'event-schedule',
];
export const containers = ['page', 'section', 'container', 'columns', 'repeater', 'global-section'];
export const id = () => globalThis.crypto.randomUUID();
export function node(type, props = {}, children = []) {
  return { id: id(), type, props, children, style: {}, responsive: {} };
}
export function createDocument({ title = 'Untitled website', mode = 'fixed' } = {}) {
  return {
    id: id(),
    type: 'page',
    schemaVersion: 1,
    title,
    mode,
    theme: defaultTheme(),
    props: {},
    style: {},
    responsive: {},
    children: [
      node('section', { name: 'Introduction' }, [
        node('heading', { text: 'Make something worth sharing.', level: 1 }),
        node('text', {
          text: 'A place for your ideas, your business, and the people you bring together.',
        }),
        node('button', { text: 'Discover more', href: '#details' }),
      ]),
      node('section', { name: 'Details' }, [
        node('heading', { text: 'Thoughtfully made.', level: 2 }),
        node('text', { text: 'Add your story here, or connect this section to your system.' }),
      ]),
    ],
  };
}
export function walk(root, visit, parent = null) {
  visit(root, parent);
  for (const c of root.children || []) walk(c, visit, root);
}
export function findNode(root, wanted) {
  let result = null;
  walk(root, (n) => {
    if (n.id === wanted) result = n;
  });
  return result;
}
export function findParent(root, wanted) {
  let result = null;
  walk(root, (n, p) => {
    if (n.id === wanted) result = p;
  });
  return result;
}
export function cloneNode(n) {
  const copy = structuredClone(n);
  walk(copy, (c) => (c.id = id()));
  return copy;
}
export const safeUrl = (value, { asset = false } = {}) => {
  if (
    typeof value !== 'string' ||
    value.length > 3000 ||
    /[\u0000-\u0020\u007f]/.test(value) ||
    value.startsWith('//') ||
    value.includes('\\')
  )
    return '';
  if (value.startsWith('/') || (!asset && value.startsWith('#'))) return value;
  try {
    const u = new URL(value);
    if (
      ['https:', 'http:'].includes(u.protocol) ||
      (!asset && ['mailto:', 'tel:'].includes(u.protocol))
    )
      return value;
  } catch {}
  return '';
};
const styleKeys = new Set([
  'color',
  'backgroundColor',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'fontFamily',
  'textAlign',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'width',
  'minWidth',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'gap',
  'maxWidth',
  'minHeight',
  'opacity',
  'borderRadius',
  'borderWidth',
  'borderStyle',
  'borderColor',
  'boxShadow',
  'overflow',
  'display',
  'gridColumns',
  'alignItems',
  'background',
  'motion',
  'freeform',
  'height',
]);
const enumValues = {
  borderStyle: ['solid', 'dashed', 'none'],
  boxShadow: ['none', 'soft', 'lifted'],
  overflow: ['visible', 'hidden'],
  flexDirection: ['row', 'column'],
  flexWrap: ['wrap', 'nowrap'],
  justifyContent: ['start', 'center', 'end', 'space-between'],
  textAlign: ['left', 'center', 'right'],
  display: ['block', 'grid', 'flex', 'none'],
  alignItems: ['start', 'center', 'end', 'stretch'],
};
function validStyles(style) {
  if (!style || typeof style !== 'object' || Array.isArray(style))
    throw new Error('Invalid style settings.');
  for (const [k, v] of Object.entries(style)) {
    if (!styleKeys.has(k)) throw new Error(`Unsupported style: ${k}`);
    if (
      ['color', 'backgroundColor', 'borderColor'].includes(k) &&
      !(
        colorRoles.includes(v) ||
        /^#[a-f\d]{6}$/i.test(v) ||
        (k !== 'color' && v === 'transparent')
      )
    )
      throw new Error('Invalid color.');
    if (k === 'fontFamily' && !fonts.includes(v)) throw new Error('Unsupported font.');
    if (enumValues[k] && !enumValues[k].includes(v)) throw new Error(`Invalid ${k}`);
    if (
      [
        'fontSize',
        'fontWeight',
        'lineHeight',
        'letterSpacing',
        'padding',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'width',
        'minWidth',
        'gap',
        'maxWidth',
        'minHeight',
        'opacity',
        'borderRadius',
        'borderWidth',
        'gridColumns',
        'height',
      ].includes(k)
    ) {
      const bounds = {
        fontSize: [8, 128],
        fontWeight: [100, 900],
        lineHeight: [0.8, 3],
        letterSpacing: [-0.04, 0.3],
        padding: [0, 240],
        paddingTop: [0, 240],
        paddingRight: [0, 240],
        paddingBottom: [0, 240],
        paddingLeft: [0, 240],
        width: [1, 100],
        minWidth: [0, 2400],
        gap: [0, 160],
        maxWidth: [100, 2400],
        minHeight: [0, 1600],
        height: [0, 1600],
        opacity: [0, 1],
        borderRadius: [0, 200],
        borderWidth: [0, 12],
        gridColumns: [1, 6],
      }[k];
      if (!Number.isFinite(v) || v < bounds[0] || v > bounds[1]) throw new Error(`Invalid ${k}`);
    }
    if (k === 'background') {
      if (!v || !['solid', 'gradient', 'image', 'video'].includes(v.type))
        throw new Error('Invalid background.');
      for (const color of [v.color, v.overlay, v.from, v.to].filter(Boolean))
        if (!/^#[a-f\d]{6}$/i.test(color)) throw new Error('Invalid background color.');
      if (
        v.opacity !== undefined &&
        (!Number.isFinite(v.opacity) || v.opacity < 0 || v.opacity > 1)
      )
        throw new Error('Invalid overlay opacity.');
      if (v.angle !== undefined && (!Number.isFinite(v.angle) || v.angle < 0 || v.angle > 360))
        throw new Error('Invalid gradient angle.');
      if (v.focal !== undefined && !/^\d{1,3}% \d{1,3}%$/.test(v.focal))
        throw new Error('Invalid focal point.');
      if (v.fit && !['cover', 'contain'].includes(v.fit)) throw new Error('Invalid fit.');
      if (
        Object.keys(v).some(
          (k) =>
            ![
              'type',
              'color',
              'overlay',
              'from',
              'to',
              'opacity',
              'angle',
              'assetId',
              'posterId',
              'fit',
              'focal',
            ].includes(k),
        )
      )
        throw new Error('Unsupported background setting.');
    }
    if (
      k === 'motion' &&
      (!v ||
        !['none', 'fade', 'rise', 'slide', 'scale'].includes(v.preset) ||
        !Number.isFinite(v.duration) ||
        v.duration < 100 ||
        v.duration > 1200 ||
        !Number.isFinite(v.delay) ||
        v.delay < 0 ||
        v.delay > 1500 ||
        (v.easing !== undefined &&
          !['ease-out', 'ease-in-out', 'linear', 'cubic-bezier(0.16,1,0.3,1)'].includes(
            v.easing,
          )) ||
        (v.trigger !== undefined && !['entrance', 'hover', 'section'].includes(v.trigger)))
    )
      throw new Error('Invalid transition.');
    if (
      k === 'freeform' &&
      (!v ||
        Object.keys(v).some((k) => !['x', 'y', 'width', 'height', 'z'].includes(k)) ||
        Object.values(v).some((x) => !Number.isFinite(x) || x < 0 || x > 1600))
    )
      throw new Error('Invalid free-form bounds.');
  }
}
export function validateDocument(doc) {
  if (doc?.analytics !== undefined) validateAnalytics(doc.analytics);
  if (
    !doc ||
    doc.schemaVersion !== 1 ||
    doc.type !== 'page' ||
    !['fixed', 'live'].includes(doc.mode)
  )
    throw new Error('Unsupported website document.');
  if (typeof doc.title !== 'string' || doc.title.length > 180)
    throw new Error('Invalid website title.');
  if (new TextEncoder().encode(JSON.stringify(doc)).length > 500000)
    throw new Error('Website document is too large.');
  if (doc.context) {
    if (
      doc.context.version !== 1 ||
      !['storefront', 'event', 'landing'].includes(doc.context.purpose) ||
      typeof doc.context.sourceId !== 'string' ||
      doc.context.sourceId.length > 160 ||
      doc.context.setupComplete !== 1 ||
      Object.keys(doc.context).some(
        (k) => !['version', 'purpose', 'sourceId', 'setupComplete'].includes(k),
      )
    )
      throw new Error('Invalid website context.');
  }
  validatePageSettings(doc.seo);
  const seen = new Set();
  let count = 0;
  const visit = (n, depth = 0) => {
    if (depth > 8 || ++count > 500) throw new Error('Website exceeds nesting or element limits.');
    if (!n || typeof n.id !== 'string' || !n.id || n.id.length > 100 || seen.has(n.id))
      throw new Error('Invalid or duplicate element identity.');
    seen.add(n.id);
    if (n !== doc && !nodeTypes.includes(n.type)) throw new Error('Unsupported element type.');
    if (!Array.isArray(n.children) || (!containers.includes(n.type) && n.children.length))
      throw new Error('Invalid parent or nesting.');
    if (!n.props || typeof n.props !== 'object' || Array.isArray(n.props))
      throw new Error('Invalid element properties.');
    const allowed = [
      'items',
      'aspect',
      'focalX',
      'focalY',
      'decorative',
      'posterId',
      'sectionId',
      'offset',
      'sortField',
      'sortDirection',
      'filterField',
      'filterValue',
      'emptyText',
      'name',
      'text',
      'level',
      'href',
      'assetId',
      'assetIds',
      'alt',
      'caption',
      'source',
      'limit',
      'action',
      'collection',
      'fit',
      'variant',
      'widgetId',
      'componentId',
      'componentVersion',
      'componentSettings',
      'fallbackText',
    ];
    if (Object.keys(n.props).some((k) => !allowed.includes(k)))
      throw new Error('Unsupported property.');
    validateContentProps(n.type, n.props);
    validateComponentProps(n.type, n.props);
    for (const [k, v] of Object.entries(n.props)) {
      if (k === 'items') continue;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (
          !['text', 'href', 'assetId', 'alt'].includes(k) ||
          typeof v.source !== 'string' ||
          !v.source ||
          v.source.length > 160 ||
          !/^[\w.-]{1,160}$/.test(v.source) ||
          v.source
            .split('.')
            .some((x) =>
              [
                '__proto__',
                'prototype',
                'constructor',
                'guest',
                'guests',
                'patient',
                'patients',
                'encounter',
                'encounters',
              ].includes(x),
            ) ||
          typeof v.path !== 'string' ||
          !/^[\w.-]{1,160}$/.test(v.path) ||
          v.path.split('.').some((x) => ['__proto__', 'prototype', 'constructor'].includes(x)) ||
          (v.format !== undefined && !['text', 'currency', 'date'].includes(v.format)) ||
          Object.keys(v).some((k) => !['source', 'path', 'format'].includes(k))
        )
          throw new Error('Invalid data connection.');
      } else if (Array.isArray(v)) {
        if (
          k !== 'assetIds' ||
          v.length > 50 ||
          v.some((x) => typeof x !== 'string' || x.length > 160)
        )
          throw new Error('Invalid asset selection.');
      } else if (typeof v === 'string') {
        if (v.length > (k === 'componentSettings' ? 50000 : 12000))
          throw new Error('Text is too long.');
      } else if (typeof v !== 'number' || !Number.isFinite(v))
        throw new Error('Invalid property value.');
    }
    if (n.type === 'repeater') {
      walk(n.children[0] || n, (child) => {
        if (
          ['component', 'widget', 'header', 'footer', 'global-section', 'repeater'].includes(
            child.type,
          )
        )
          throw new Error(
            'Collection cards cannot contain operational widgets, linked sections or nested repeaters.',
          );
      });
      if (
        n.children.length !== 1 ||
        !['container', 'columns', 'section'].includes(n.children[0].type)
      )
        throw new Error('A repeater needs one editable card template.');
      if (
        typeof n.props.source !== 'string' ||
        !/^[\w.-]{1,160}$/.test(n.props.source) ||
        n.props.source
          .split('.')
          .some((x) =>
            [
              '__proto__',
              'constructor',
              'prototype',
              'guest',
              'guests',
              'patients',
              'encounters',
              'patient',
              'encounter',
              'item',
            ].includes(x),
          )
      )
        throw new Error('Choose an approved collection.');
      if (
        n.props.offset !== undefined &&
        (!Number.isInteger(n.props.offset) || n.props.offset < 0 || n.props.offset > 10000)
      )
        throw new Error('Invalid collection offset.');
      for (const key of ['sortField', 'filterField'])
        if (
          n.props[key] !== undefined &&
          (typeof n.props[key] !== 'string' ||
            (n.props[key] &&
              (!/^[\w.-]{1,160}$/.test(n.props[key]) ||
                n.props[key]
                  .split('.')
                  .some((x) => ['__proto__', 'constructor', 'prototype'].includes(x)))))
        )
          throw new Error('Invalid collection field.');
      if (n.props.sortDirection !== undefined && !['asc', 'desc'].includes(n.props.sortDirection))
        throw new Error('Invalid sort direction.');
      for (const [key, max] of [
        ['filterValue', 200],
        ['emptyText', 300],
      ])
        if (
          n.props[key] !== undefined &&
          (typeof n.props[key] !== 'string' || n.props[key].length > max)
        )
          throw new Error('Invalid collection text.');
    }
    if (
      n.type === 'global-section' &&
      (typeof n.props.sectionId !== 'string' ||
        !/^[\w-]{1,100}$/.test(n.props.sectionId) ||
        n.children.length !== 1 ||
        n.children[0].type !== 'section')
    )
      throw new Error('A linked section needs a valid source and fallback section.');
    if (n.type === 'global-section')
      walk(n.children[0], (child) => {
        if (child.type === 'global-section')
          throw new Error('Linked sections cannot contain linked sections.');
      });
    if (
      n.props.source !== undefined &&
      (typeof n.props.source !== 'string' ||
        !/^[\w.-]{1,160}$/.test(n.props.source) ||
        n.props.source
          .split('.')
          .some((x) =>
            [
              '__proto__',
              'prototype',
              'constructor',
              'guest',
              'guests',
              'patient',
              'patients',
              'encounter',
              'encounters',
            ].includes(x),
          ))
    )
      throw new Error('Invalid data source.');
    if (n.props.level !== undefined && ![1, 2, 3, 4, 5, 6].includes(n.props.level))
      throw new Error('Invalid heading level.');
    if (
      n.props.limit !== undefined &&
      (!Number.isInteger(n.props.limit) || n.props.limit < 1 || n.props.limit > 50)
    )
      throw new Error('Invalid data limit.');
    if (
      n.type === 'widget' &&
      ![
        'pixelcore.event-rsvp',
        'pixelcore.event-people',
        'pixelcore.event-story',
        'pixelcore.event-countdown',
        'pixelcore.event-venue',
        'pixelcore.event-notes',
        'pixelcore.event-gifts',
        'pixelcore.event-wishes',
        'pixelcore.social-links',
      ].includes(n.props.widgetId)
    )
      throw new Error('Unsupported host widget.');
    validStyles(n.style || {});
    for (const [bp, value] of Object.entries(n.responsive || {})) {
      if (!['tablet', 'phone'].includes(bp)) throw new Error('Invalid breakpoint.');
      validStyles(value);
    }
    for (const c of n.children) visit(c, depth + 1);
  };
  visit(doc);
  for (const kind of ['header', 'footer'])
    if (doc.children.filter((n) => n.type === kind).length > 1)
      throw new Error('Only one header and footer are allowed.');
  if (!doc.theme || !doc.theme.colors) throw new Error('Missing theme.');
  if (Object.keys(doc.theme.colors).some((k) => !colorRoles.includes(k)))
    throw new Error('Unsupported theme color role.');
  for (const role of colorRoles)
    if (!/^#[a-f\d]{6}$/i.test(doc.theme.colors[role]))
      throw new Error(`Invalid theme color: ${role}`);
  for (const font of ['headingFont', 'bodyFont'])
    if (!fonts.includes(doc.theme[font])) throw new Error('Unsupported theme font.');
  for (const [key, min, max] of [
    ['baseSize', 12, 28],
    ['scale', 1, 2],
    ['radius', 0, 48],
  ])
    if (!Number.isFinite(doc.theme[key]) || doc.theme[key] < min || doc.theme[key] > max)
      throw new Error(`Invalid theme ${key}`);
  return doc;
}
// Legacy documents remain readable, but font families are always theme-owned.
export function normalizeGlobalFonts(value) {
  const doc = structuredClone(validateDocument(value));
  walk(doc, (n) => {
    if (n.style) delete n.style.fontFamily;
    for (const style of Object.values(n.responsive || {})) delete style.fontFamily;
  });
  return doc;
}
export function resolveValue(value, data) {
  if (!value || typeof value !== 'object') return value;
  if (typeof value.source !== 'string' || typeof value.path !== 'string') return undefined;
  let result = data;
  for (const key of [...value.source.split('.'), ...value.path.split('.')]) {
    if (
      [
        '__proto__',
        'constructor',
        'prototype',
        'guest',
        'guests',
        'patient',
        'patients',
        'encounter',
        'encounters',
      ].includes(key) ||
      result == null ||
      typeof result !== 'object' ||
      !Object.hasOwn(result, key)
    )
      return undefined;
    result = result[key];
  }
  return ['string', 'number'].includes(typeof result) ? result : undefined;
}

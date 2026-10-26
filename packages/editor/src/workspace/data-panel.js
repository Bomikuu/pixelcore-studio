import { el, button, field, modal } from '../components/ui/index.js';
import {
  findNode,
  findParent,
  node,
  resolveValue,
  formatValue,
  collectionRows,
  publicationFindings,
} from '@sitebuilder/core';

const forbidden =
  /(^|[._-])(guest|guests|clinical|patient|patients|token|tokens|password|secret|credentials|dietary|invitation|invitationtoken)([._-]|$)/i;
const pathPattern = /^[a-zA-Z_][\w]*(\.[a-zA-Z_][\w]*)*$/;
const safePath = (value) =>
  typeof value === 'string' &&
  value.length <= 160 &&
  pathPattern.test(value) &&
  !value.split('.').some((part) => ['__proto__', 'constructor', 'prototype'].includes(part)) &&
  !forbidden.test(value.replace(/([a-z])([A-Z])/g, '$1_$2'));
const types = ['text', 'url', 'asset', 'currency', 'date'];
const f = (path, label, type = 'text') => ({ path, label, type });
const fallback = [
  {
    id: 'identity',
    label: 'Business',
    kind: 'record',
    fields: [f('name', 'Business name'), f('description', 'Introduction')],
  },
  {
    id: 'event',
    label: 'Event',
    kind: 'record',
    capability: 'event',
    fields: [
      f('title', 'Event title'),
      f('date', 'Date', 'date'),
      f('venue', 'Venue'),
      f('description', 'Introduction'),
    ],
  },
  {
    id: 'products',
    label: 'Products',
    kind: 'collection',
    capability: 'products',
    fields: [
      f('name', 'Name'),
      f('description', 'Description'),
      f('price', 'Price', 'currency'),
      f('url', 'Product link', 'url'),
      f('assetId', 'Product image', 'asset'),
    ],
  },
  {
    id: 'services',
    label: 'Services',
    kind: 'collection',
    capability: 'services',
    fields: [
      f('name', 'Name'),
      f('description', 'Description'),
      f('price', 'Price', 'currency'),
      f('url', 'Service link', 'url'),
      f('assetId', 'Service image', 'asset'),
    ],
  },
  {
    id: 'schedule',
    label: 'Schedule',
    kind: 'collection',
    capability: 'event',
    fields: [f('title', 'Title'), f('time', 'Time'), f('description', 'Details')],
  },
  {
    id: 'event.people',
    label: 'Event people',
    kind: 'collection',
    capability: 'event',
    fields: [f('name', 'Name'), f('role', 'Role'), f('assetId', 'Portrait', 'asset')],
  },
  {
    id: 'event.stories',
    label: 'Event stories',
    kind: 'collection',
    capability: 'event',
    fields: [f('title', 'Title'), f('description', 'Story'), f('assetId', 'Image', 'asset')],
  },
];
const lookup = (value, path) => {
  if (!safePath(path)) return undefined;
  let current = value;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, part)) return undefined;
    current = current[part];
  }
  return current;
};

// The catalog describes public fields; runtime object keys are never discovered.
export function sourceCatalog(adapter = {}, data = {}) {
  const declared = Array.isArray(adapter.dataSources)
    ? adapter.dataSources
    : fallback.filter((source) =>
        source.capability
          ? adapter.capabilities?.includes(source.capability)
          : lookup(data, source.id) !== undefined,
      );
  const seen = new Set();
  return declared.flatMap((source) => {
    if (
      !source ||
      !safePath(source.id) ||
      source.id === 'item' ||
      seen.has(source.id) ||
      !['record', 'collection'].includes(source.kind)
    )
      return [];
    seen.add(source.id);
    const paths = new Set();
    const fields = (Array.isArray(source.fields) ? source.fields : []).flatMap((entry) => {
      if (!entry || !safePath(entry.path) || paths.has(entry.path) || !types.includes(entry.type))
        return [];
      paths.add(entry.path);
      return [
        {
          path: entry.path,
          label: String(entry.label || entry.path).slice(0, 100),
          type: entry.type,
        },
      ];
    });
    if (!fields.length) return [];
    return [
      {
        id: source.id,
        label: String(source.label || source.id).slice(0, 100),
        kind: source.kind,
        fields,
      },
    ];
  });
}

const binding = (field) => ({
  source: 'item',
  path: field.path,
  ...(['currency', 'date'].includes(field.type) ? { format: field.type } : {}),
});
export function createRepeater(source) {
  if (
    !source ||
    source.kind !== 'collection' ||
    !safePath(source.id) ||
    !Array.isArray(source.fields)
  )
    throw new Error('Choose an approved collection.');
  const fields = source.fields.filter(
    (entry) => safePath(entry.path) && types.includes(entry.type),
  );
  const title = fields.find((entry) => entry.type === 'text');
  const image = fields.find((entry) => entry.type === 'asset');
  const url = fields.find((entry) => entry.type === 'url');
  const detail =
    fields.find((entry) => entry.type === 'currency') ||
    fields.find((entry) => entry.type === 'text' && entry !== title);
  const children = [];
  if (image)
    children.push(node('image', { assetId: binding(image), alt: title ? binding(title) : '' }));
  if (title) children.push(node('heading', { text: binding(title), level: 3 }));
  if (detail) children.push(node('text', { text: binding(detail) }));
  if (url) children.push(node('button', { text: 'View details', href: binding(url) }));
  if (!children.length)
    children.push(node('text', { text: 'Connect a card field to your collection.' }));
  const card = node('container', { name: `${source.label} card` }, children);
  card.style = { display: 'grid', gridColumns: 1, gap: 16, padding: 24 };
  const repeater = node(
    'repeater',
    {
      name: source.label,
      source: source.id,
      limit: 6,
      offset: 0,
      sortDirection: 'asc',
      emptyText: 'Nothing to show yet.',
    },
    [card],
  );
  repeater.style = { display: 'grid', gridColumns: 3, gap: 24 };
  repeater.responsive = { tablet: { gridColumns: 2 }, phone: { gridColumns: 1 } };
  return repeater;
}

const targets = (n) =>
  n.type === 'image'
    ? ['assetId', 'alt']
    : n.type === 'button'
      ? ['text', 'href']
      : ['heading', 'text'].includes(n.type)
        ? ['text']
        : [];
const labels = {
  text: 'Text',
  href: 'Link destination',
  assetId: 'Image',
  alt: 'Alternative text',
};
const compatible = (target, entry) =>
  target === 'assetId'
    ? entry.type === 'asset'
    : target === 'href'
      ? entry.type === 'url'
      : target === 'alt'
        ? entry.type === 'text'
        : ['text', 'currency', 'date'].includes(entry.type);
function itemSource(document, n, catalog) {
  let current = n;
  while ((current = findParent(document, current.id))) {
    if (current.type === 'repeater')
      return catalog.find(
        (entry) => entry.id === current.props.source && entry.kind === 'collection',
      );
  }
  return null;
}
const section = (d, title) =>
  el(d, 'section', { class: 'inspector-section' }, [el(d, 'h3', { text: title })]);
const connected = (value) => value && typeof value === 'object' && typeof value.source === 'string';
const selectOptions = (entries, first) => [{ value: '', label: first }, ...entries];

export function renderBindings(ctx, n) {
  const { d, panel, history, adapter = {}, data = {}, command, root, report = () => {} } = ctx;
  const supported = targets(n);
  if (!supported.length) return;
  const catalog = sourceCatalog(adapter, data);
  const item = itemSource(history.document, n, catalog);
  const sources = [
    ...catalog.filter((source) => source.kind === 'record'),
    ...(item ? [{ ...item, id: 'item', label: `${item.label} card` }] : []),
  ];
  const group = section(d, 'Data connections');
  group.append(
    el(d, 'p', {
      class: 'muted',
      text: 'Connected values update from your system. Detach a connection to write a fixed value.',
    }),
  );
  for (const target of supported) {
    const value = n.props[target];
    if (connected(value)) {
      const source = sources.find((entry) => entry.id === value.source);
      const entry = source?.fields.find((field) => field.path === value.path);
      const caption = entry ? `${source.label} / ${entry.label}` : 'Source unavailable';
      group.append(
        el(d, 'p', { class: 'inline-feedback', text: `${labels[target]} connected: ${caption}` }),
      );
      if (adapter.openSource && value.source !== 'item' && entry)
        group.append(
          button(d, `Edit ${labels[target].toLowerCase()} at source`, () =>
            adapter.openSource(value),
          ),
        );
      group.append(
        button(d, `Detach ${labels[target].toLowerCase()}`, () =>
          modal(
            root,
            'Use a fixed value?',
            el(d, 'p', {
              text: 'This connection will become a fixed value. The system record stays unchanged.',
            }),
            () => {
              let envelope = data;
              if (value.source === 'item' && item) {
                let parent = n;
                while (
                  (parent = findParent(history.document, parent.id)) &&
                  parent.type !== 'repeater'
                ) {}
                envelope = {
                  ...data,
                  item: parent ? collectionRows(data, parent.props).rows[0] || {} : {},
                };
              }
              const scalar =
                target === 'text' ? formatValue(value, envelope) : resolveValue(value, envelope);
              command(
                target === 'text'
                  ? { type: 'text', id: n.id, value: String(scalar ?? ''), detach: true }
                  : {
                      type: 'props',
                      id: n.id,
                      value: { [target]: String(scalar ?? '') },
                      detach: true,
                    },
              );
            },
            { confirmLabel: 'Detach connection' },
          ),
        ),
      );
    }
    const choices = sources.flatMap((source) =>
      source.fields
        .filter((entry) => compatible(target, entry))
        .map((entry) => ({
          value: JSON.stringify([source.id, entry.path]),
          label: `${source.label} / ${entry.label}`,
          source,
          entry,
        })),
    );
    if (!choices.length) continue;
    let choice = '';
    group.append(
      field(
        d,
        `Connect ${labels[target].toLowerCase()}`,
        '',
        (value) => {
          choice = value;
        },
        { options: selectOptions(choices, 'Choose a field') },
      ),
    );
    group.append(
      button(d, `Connect ${labels[target].toLowerCase()}`, () => {
        const selected = choices.find((entry) => entry.value === choice);
        if (!selected) {
          report('Choose a field first.');
          return;
        }
        const { source, entry } = selected;
        command({
          type: 'props',
          id: n.id,
          value: {
            [target]: {
              source: source.id,
              path: entry.path,
              ...(target === 'text' && ['currency', 'date'].includes(entry.type)
                ? { format: entry.type }
                : {}),
            },
          },
        });
      }),
    );
  }
  if (!sources.length)
    group.append(
      el(d, 'p', {
        class: 'muted',
        text: 'No approved record fields are available. Insert connected cards to use collection fields.',
      }),
    );
  panel.append(group);
}

export function renderCollectionControls(ctx, n) {
  const { d, panel, command, adapter = {}, data = {} } = ctx;
  const sources = sourceCatalog(adapter, data).filter((source) => source.kind === 'collection');
  const current = sources.find((source) => source.id === n.props.source);
  const group = section(d, 'Connected collection');
  const change = (key, value) => command({ type: 'props', id: n.id, value: { [key]: value } });
  group.append(
    field(d, 'Collection', n.props.source, (value) => change('source', value), {
      options: [
        ...(!current ? [{ value: n.props.source, label: 'Source unavailable' }] : []),
        ...sources.map((source) => ({ value: source.id, label: source.label })),
      ],
    }),
  );
  if (!current)
    group.append(
      el(d, 'p', {
        role: 'status',
        class: 'muted',
        text: 'This collection is unavailable. Reconnect an approved source to show cards.',
      }),
    );
  group.append(
    field(d, 'Maximum cards', n.props.limit ?? 6, (value) => change('limit', value), {
      type: 'number',
      min: 1,
      max: 50,
    }),
    field(d, 'Skip first records', n.props.offset ?? 0, (value) => change('offset', value), {
      type: 'number',
      min: 0,
      max: 10000,
    }),
  );
  const fields = current?.fields.filter((entry) => entry.type !== 'asset') || [];
  const options = selectOptions(
    fields.map((entry) => ({ value: entry.path, label: entry.label })),
    'None',
  );
  group.append(
    field(d, 'Filter field', n.props.filterField || '', (value) => change('filterField', value), {
      options,
    }),
    field(d, 'Filter equals', n.props.filterValue ?? '', (value) => change('filterValue', value)),
    field(d, 'Sort field', n.props.sortField || '', (value) => change('sortField', value), {
      options,
    }),
    field(
      d,
      'Sort direction',
      n.props.sortDirection || 'asc',
      (value) => change('sortDirection', value),
      {
        options: [
          { value: 'asc', label: 'Ascending' },
          { value: 'desc', label: 'Descending' },
        ],
      },
    ),
    field(d, 'Empty message', n.props.emptyText || '', (value) => change('emptyText', value)),
    el(d, 'p', {
      class: 'muted',
      text: 'Edit the single card in Layers. Its design repeats for every matching record.',
    }),
  );
  panel.append(group);
}

export function renderDataPanel(ctx) {
  const {
    d,
    panel,
    history,
    selectedId,
    adapter = {},
    data = {},
    insertNode,
    report = () => {},
  } = ctx;
  panel.replaceChildren();
  panel.append(
    el(d, 'h2', { class: 'panel-heading', text: 'Connected data' }),
    el(d, 'p', {
      class: 'muted',
      text: adapter.workspace?.sampleData
        ? 'Sample data · Connect your host system to use live records.'
        : 'Choose public information from your system. Your design stays separate from the records.',
    }),
  );
  const refreshState = ctx.dataStatus || { state: 'ready' };
  panel.append(
    el(d, 'p', {
      role: refreshState.state === 'error' ? 'alert' : 'status',
      text:
        refreshState.state === 'loading'
          ? 'Refreshing approved data…'
          : refreshState.state === 'error'
            ? 'Refresh failed. The last successful data remains visible. ' + refreshState.error
            : refreshState.updatedAt
              ? 'Last refreshed ' + new Date(refreshState.updatedAt).toLocaleString()
              : 'Current approved data',
    }),
  );
  if (adapter.loadData)
    panel.append(
      button(
        d,
        refreshState.state === 'error' ? 'Retry data refresh' : 'Refresh live data',
        () => ctx.refreshData?.(),
        { disabled: refreshState.state === 'loading', icon: 'data' },
      ),
    );
  for (const finding of publicationFindings(history.document, data, adapter.capabilities).filter(
    (f) => f.kind === 'binding',
  ))
    panel.append(button(d, finding.message, () => ctx.revealNode?.(finding.id)));
  const catalog = sourceCatalog(adapter, data);
  if (!catalog.length)
    panel.append(
      el(d, 'p', {
        role: 'status',
        class: 'muted',
        text: 'No approved data sources are available for this website.',
      }),
    );
  for (const source of catalog) {
    const value = lookup(data, source.id);
    const available =
      source.kind === 'collection'
        ? Array.isArray(value)
        : value && typeof value === 'object' && !Array.isArray(value);
    const group = section(d, source.label);
    group.append(
      el(d, 'p', {
        class: 'muted',
        text: !available
          ? 'Source unavailable'
          : source.kind === 'collection'
            ? value.length
              ? `${value.length} records · One reusable card design`
              : '0 records · Visitors see the collection’s designed empty state'
            : 'Connected record',
      }),
    );
    const list = el(d, 'ul', { class: 'data-fields' });
    for (const entry of source.fields)
      list.append(el(d, 'li', { text: `${entry.label} · ${entry.type}` }));
    group.append(list);
    if (source.kind === 'collection')
      group.append(
        button(
          d,
          `Insert ${source.label.toLowerCase()} cards`,
          () => {
            if (!available || !insertNode) {
              report('This collection is not available.');
              return;
            }
            insertNode(createRepeater(source));
          },
          { disabled: !available || !insertNode },
        ),
      );
    panel.append(group);
  }
  const n = findNode(history.document, selectedId);
  if (n?.type === 'repeater') renderCollectionControls(ctx, n);
  else if (n && targets(n).length) renderBindings(ctx, n);
  else
    panel.append(
      el(d, 'p', {
        class: 'muted',
        text: 'Select text, an image or a button to connect an individual field.',
      }),
    );
}

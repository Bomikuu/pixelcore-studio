import { el, button, field } from '../../packages/editor/src/components/ui/index.js';
import { actionLink } from './shell.js';
export function mountDashboard(region, { workspace, client }) {
  const d = region.ownerDocument;
  region.replaceChildren(
    el(d, 'div', { class: 'studio-intro' }, [
      el(d, 'div', {}, [
        el(d, 'h1', { text: 'Overview' }),
        el(d, 'p', {
          class: 'muted',
          text: workspace.workspace.sample
            ? 'Your example workspace uses local sample content. Connect a platform below to manage its business websites.'
            : `Manage ${workspace.workspace.name} websites using your live platform data.`,
        }),
      ]),
      actionLink(d, 'Open website builder', '/studio/builder', { glyph: 'edit' }),
    ]),
  );
  let sites = workspace.sites || [],
    page = workspace.page,
    generation = 0,
    alive = true;
  const serverPaged = !!(client && page);
  const hasChanges = (site) => site.unpublishedChanges ?? (!site.published && site.version > 0);
  const fallback = {
    websites: sites.length,
    published: sites.filter((s) => s.published).length,
    drafts: sites.filter(hasChanges).length,
  };
  const numbers = Object.fromEntries(
    Object.entries(fallback).map(([key, value]) => [
      key,
      Number.isSafeInteger(workspace.summary?.[key]) && workspace.summary[key] >= 0
        ? workspace.summary[key]
        : value,
    ]),
  );
  const latest =
    workspace.summary?.updatedAt ||
    sites
      .map((s) => s.updatedAt)
      .filter((value) => Number.isFinite(Date.parse(value)))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const dateLabel = (value) =>
    Number.isFinite(Date.parse(value))
      ? new Date(value).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'No activity yet';
  const summary = el(d, 'dl', { class: 'studio-summary', 'aria-label': 'Workspace summary' });
  for (const [label, value, help, date] of [
    ['Websites', numbers.websites, 'In this business workspace'],
    ['Published', numbers.published, 'Available to your visitors'],
    ['Unpublished changes', numbers.drafts, 'New drafts and saved updates'],
    ['Latest activity', dateLabel(latest), 'Most recent website update', true],
  ])
    summary.append(
      el(d, 'div', { class: 'studio-summary-tile' }, [
        el(d, 'dt', { text: label }),
        el(d, 'dd', {
          text: date ? value : new Intl.NumberFormat().format(value),
          ...(date ? { class: 'summary-date' } : {}),
        }),
        el(d, 'dd', { class: 'summary-help', text: help }),
      ]),
    );
  for (const [index, value] of [
    [0, 'all'],
    [1, 'published'],
    [2, 'drafts'],
  ])
    summary.children[index].append(
      button(d, 'View ' + ['websites', 'published', 'unpublished'][index], () => {
        filter = value;
        for (const control of filters.querySelectorAll('button'))
          control.setAttribute('aria-pressed', String(control.dataset.filter === value));
        load();
        list.scrollIntoView?.({ block: 'nearest' });
      }),
    );
  region.append(summary);
  const list = el(d, 'div', { class: 'studio-site-list', 'aria-live': 'polite' }),
    filters = el(d, 'div', { class: 'studio-filters', 'aria-label': 'Filter websites' });
  const currentUrl = new URL(d.defaultView.location.href);
  let filter = ['published', 'drafts'].includes(currentUrl.searchParams.get('status'))
    ? currentUrl.searchParams.get('status')
    : 'all';
  const search = field(d, 'Search websites', currentUrl.searchParams.get('q') || '', () => {});
  const searchInput = search.querySelector('input');
  searchInput.type = 'search';
  const sorting = field(
    d,
    'Sort websites',
    currentUrl.searchParams.get('sort') || 'updated',
    () => {},
    {
      options: [
        { value: 'updated', label: 'Recently edited' },
        { value: 'oldest', label: 'Oldest edited' },
        { value: 'title', label: 'Name' },
      ],
    },
  );
  const status = el(d, 'p', { role: 'status', class: 'muted' });
  const pagination = el(d, 'div', { class: 'studio-actions' });
  let timer;
  async function load(offset = 0) {
    const url = new URL(d.defaultView.location.href);
    for (const [key, value] of [
      ['q', searchInput.value.trim()],
      ['status', filter === 'all' ? '' : filter],
      ['sort', sorting.querySelector('select').value],
      ['offset', offset ? String(offset) : ''],
    ]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    d.defaultView.history.replaceState(null, '', url);
    if (!serverPaged) {
      drawRows();
      return;
    }
    const token = ++generation;
    status.textContent = 'Loading websites…';
    list.setAttribute('aria-busy', 'true');
    try {
      const result = await client.send('workspace/' + url.search);
      if (!alive || token !== generation) return;
      sites = result.sites;
      page = result.page;
      drawRows();
    } catch (error) {
      if (alive && token === generation) {
        status.textContent = error.message + ' Retry your search.';
        status.setAttribute('role', 'alert');
        pagination.replaceChildren(button(d, 'Retry loading websites', () => load(offset)));
      }
    } finally {
      if (alive && token === generation) list.removeAttribute('aria-busy');
    }
  }
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => load(), 250);
  });
  sorting.querySelector('select').addEventListener('change', () => load());
  const drawRows = () => {
    list.replaceChildren();
    const visible = sites.filter((site) =>
      filter === 'published' ? site.published : filter === 'drafts' ? hasChanges(site) : true,
    );
    const query = searchInput.value.trim().toLowerCase();
    const shown = serverPaged
      ? visible
      : visible.filter((site) => site.title.toLowerCase().includes(query));
    if (!serverPaged)
      shown.sort((a, b) =>
        sorting.querySelector('select').value === 'title'
          ? a.title.localeCompare(b.title)
          : sorting.querySelector('select').value === 'oldest'
            ? (Date.parse(a.updatedAt) || 0) - (Date.parse(b.updatedAt) || 0)
            : (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
      );
    status.setAttribute('role', 'status');
    status.textContent = page
      ? `${page.total} matching websites · showing ${shown.length ? page.offset + 1 : 0}–${page.offset + shown.length}`
      : `${shown.length} websites`;
    pagination.replaceChildren();
    if (serverPaged) {
      if (page.offset > 0)
        pagination.append(
          button(d, 'Previous', () => load(Math.max(0, page.offset - page.limit)), {
            icon: 'back',
          }),
        );
      if (page.nextOffset !== null)
        pagination.append(button(d, 'Next', () => load(page.nextOffset)));
    }
    for (const site of shown) {
      const miniature = el(d, 'div', { class: 'studio-site-preview', 'aria-hidden': 'true' });
      const safeColor = (value) => (/^#[0-9a-f]{6}$/i.test(value || '') ? value : null);
      if (safeColor(site.preview?.colors?.background))
        miniature.style.backgroundColor = site.preview.colors.background;
      for (const type of site.preview?.structure || ['section', 'section'])
        miniature.append(el(d, 'span', { class: 'preview-' + type }));

      const pages = site.pageCount || 1;
      list.append(
        el(d, 'article', { class: 'studio-site-row' }, [
          miniature,
          el(d, 'div', {}, [
            el(d, 'h3', { text: site.title }),
            el(d, 'p', {
              class: 'muted',
              text: Number.isFinite(Date.parse(site.updatedAt))
                ? 'Edited ' + dateLabel(site.updatedAt)
                : 'No saved edit date',
            }),
            el(d, 'div', { class: 'studio-site-meta' }, [
              el(d, 'span', {
                class: 'studio-state' + (site.published ? ' live' : ''),
                text: site.published
                  ? hasChanges(site)
                    ? 'Published · pending updates'
                    : 'Published'
                  : site.version
                    ? 'Draft'
                    : 'Not saved yet',
              }),
              el(d, 'span', {
                class: 'muted',
                text: `${pages} ${pages === 1 ? 'page' : 'pages'} · revision ${site.version}`,
              }),
            ]),
          ]),
          el(d, 'div', { class: 'studio-site-actions' }, [
            actionLink(d, 'Edit website', '/studio/builder?site=' + encodeURIComponent(site.id), {
              secondary: true,
            }),
            el(d, 'details', { class: 'studio-row-menu' }, [
              el(d, 'summary', { 'aria-label': 'More actions for ' + site.title, text: 'More' }),
              el(d, 'div', { class: 'studio-row-menu-items' }, [
                actionLink(
                  d,
                  'Analytics',
                  '/studio/analytics?site=' + encodeURIComponent(site.id),
                  { secondary: true },
                ),
                ...(site.publicUrl
                  ? [
                      el(d, 'a', {
                        href: site.publicUrl,
                        target: '_blank',
                        rel: 'noopener',
                        text: 'View live',
                        class: 'studio-action secondary',
                      }),
                    ]
                  : []),
              ]),
            ]),
          ]),
        ]),
      );
    }
    if (!shown.length)
      list.append(
        el(d, 'div', { class: 'studio-empty' }, [
          el(d, 'h3', {
            text:
              filter === 'published'
                ? 'No published websites yet.'
                : filter === 'drafts'
                  ? 'No unpublished changes.'
                  : 'Start with a website.',
          }),
          el(d, 'p', {
            class: 'muted',
            text:
              filter === 'drafts'
                ? 'Your saved websites have no pending updates.'
                : filter === 'published'
                  ? 'Open a saved draft in the builder and publish when you are ready.'
                  : 'Choose an existing page, event or site layout in the builder.',
          }),
          ...(filter === 'drafts' ? [] : [actionLink(d, 'Open builder', '/studio/builder')]),
        ]),
      );
  };
  for (const [value, label] of [
    ['all', 'All'],
    ['published', 'Published'],
    ['drafts', 'Unpublished'],
  ])
    filters.append(
      button(
        d,
        label,
        () => {
          filter = value;
          const url = new URL(d.defaultView.location.href);
          if (value === 'all') url.searchParams.delete('status');
          else url.searchParams.set('status', value);
          d.defaultView.history.replaceState(null, '', url);
          for (const control of filters.querySelectorAll('button'))
            control.setAttribute('aria-pressed', String(control.dataset.filter === value));
          load();
        },
        { 'data-filter': value, 'aria-pressed': String(value === filter) },
      ),
    );
  drawRows();
  const websites = el(d, 'section', { class: 'studio-panel' }, [
    el(d, 'div', { class: 'studio-panel-heading' }, [el(d, 'h2', { text: 'Websites' }), filters]),
    el(d, 'p', { class: 'muted', text: 'Your saved drafts, published pages and pending updates.' }),
    el(d, 'div', { class: 'studio-discovery-controls' }, [search, sorting]),
    status,
    list,
    pagination,
  ]);
  const setup = el(d, 'section', { class: 'studio-panel' }, [
    el(d, 'h2', { text: 'Understand your audience.' }),
    el(d, 'p', {
      class: 'muted',
      text: 'Connect analytics to a published website, follow the installation guide and verify real visits in your provider. Traffic reports appear in your provider dashboard.',
    }),
    el(
      d,
      'ol',
      { class: 'studio-steps' },
      [
        'Choose your website and provider',
        'Save and publish your configuration',
        'Verify visits on your live website',
      ].map((text) => el(d, 'li', { text })),
    ),
    actionLink(d, 'Set up analytics', '/studio/analytics', { secondary: true, glyph: 'data' }),
  ]);
  region.append(el(d, 'div', { class: 'studio-overview' }, [websites, setup]));
  return {
    destroy() {
      alive = false;
      generation++;
      clearTimeout(timer);
      region.replaceChildren();
    },
  };
}

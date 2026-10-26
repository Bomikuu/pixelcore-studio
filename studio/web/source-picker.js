import { el, button, field } from '../../packages/editor/src/components/ui/index.js';
export function mountSourcePicker(region, { client, workspace }) {
  const d = region.ownerDocument;
  let current = workspace,
    alive = true,
    generation = 0,
    busy = false;
  const routeUrl = new URL(d.defaultView.location.href);
  const query = field(
      d,
      'Search pages, events and websites',
      routeUrl.searchParams.get('sourceQ') || '',
      () => {},
    ),
    kind = field(d, 'Source type', routeUrl.searchParams.get('sourceKind') || 'all', () => {}, {
      options: [
        { value: 'all', label: 'All sources' },
        { value: 'page', label: 'Landing pages' },
        { value: 'event', label: 'Events / weddings' },
        { value: 'layout', label: 'Headers & footers' },
      ],
    });
  const message = el(d, 'p', { role: 'status', class: 'muted' }),
    list = el(d, 'div'),
    pages = el(d, 'div', { class: 'studio-actions' });
  const go = async (source, control) => {
    if (busy) return;
    busy = true;
    control.disabled = true;
    try {
      const setup = await client.send('workspace/open/', {
        method: 'POST',
        body: { kind: source.kind, sourceId: source.id },
      });
      d.defaultView.location.href = '/studio/builder?site=' + encodeURIComponent(setup.id);
    } catch (error) {
      if (alive) {
        message.textContent = error.message;
        message.setAttribute('role', 'alert');
        control.disabled = false;
      }
    } finally {
      busy = false;
    }
  };
  function draw() {
    list.replaceChildren();
    pages.replaceChildren();
    for (const site of current.sites || [])
      list.append(
        el(d, 'div', { class: 'studio-source' }, [
          el(d, 'span', { text: site.title }),
          el(d, 'a', {
            href: '/studio/builder?site=' + encodeURIComponent(site.id),
            text: 'Edit website',
            class: 'studio-action secondary',
          }),
        ]),
      );
    for (const source of current.sources || [])
      list.append(
        el(d, 'div', { class: 'studio-source' }, [
          el(d, 'span', { text: source.title }, [el(d, 'small', { text: source.kind })]),
          button(d, 'Open builder', (e) => go(source, e.currentTarget), { icon: 'edit' }),
        ]),
      );
    message.setAttribute('role', 'status');
    message.textContent = list.childElementCount
      ? 'Choose an existing website or a source from your platform.'
      : 'No matching sources. Change your search or create content in your platform.';
    for (const [key, page] of [
      ['offset', current.page],
      ['sourceoffset', current.sourcePage],
    ])
      if (page) {
        const label = key === 'offset' ? 'websites' : 'sources';
        if (page.offset > 0)
          pages.append(
            button(d, 'Previous ' + label, () => load(key, Math.max(0, page.offset - page.limit))),
          );
        if (page.nextOffset !== null)
          pages.append(button(d, 'More ' + label, () => load(key, page.nextOffset)));
      }
  }
  async function load(key, offset = 0) {
    const token = ++generation;
    message.textContent = 'Finding your content…';
    const params = new URLSearchParams({
      q: query.querySelector('input').value.trim(),
      sourceQ: query.querySelector('input').value.trim(),
      sourceKind: kind.querySelector('select').value,
    });
    if (key) params.set(key, String(offset));
    const url = new URL(d.defaultView.location.href);
    url.search = params.toString();
    d.defaultView.history.replaceState(null, '', url);
    try {
      const value = await client.send('workspace/?' + params);
      if (alive && token === generation) {
        current = value;
        draw();
      }
    } catch (error) {
      if (alive && token === generation) {
        message.textContent = error.message;
        message.setAttribute('role', 'alert');
        pages.replaceChildren(button(d, 'Retry finding content', () => load(key, offset)));
      }
    }
  }
  let timer;
  query.querySelector('input').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => load(), 250);
  });
  kind.querySelector('select').addEventListener('change', () => load());
  region.replaceChildren(
    el(d, 'h1', { text: 'Choose what to build.' }),
    el(d, 'div', { class: 'studio-discovery-controls' }, [query, kind]),
    message,
    list,
    pages,
  );
  draw();
  return {
    destroy() {
      alive = false;
      generation++;
      clearTimeout(timer);
      region.replaceChildren();
    },
  };
}

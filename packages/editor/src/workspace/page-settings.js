import { el, button, field } from '../components/ui/index.js';
import { pageMetadata, pageFindings } from '@sitebuilder/core';

export function renderPageSettings({ d, panel, history, data, command, adapter, select }) {
  const doc = history.document,
    seo = doc.seo || {};
  const update = (key, value) =>
    command({ type: 'document', value: { seo: { ...history.document.seo, [key]: value } } });
  const box = el(d, 'section', { class: 'inspector-section' }, [
    el(d, 'h3', { text: 'Search & sharing' }),
  ]);
  for (const [key, label, type] of [
    ['title', 'Search title', 'text'],
    ['description', 'Search description', 'textarea'],
    ['socialTitle', 'Social title', 'text'],
    ['socialDescription', 'Social description', 'textarea'],
    ['canonical', 'Canonical URL', 'url'],
  ])
    box.append(field(d, label, seo[key] || '', (v) => update(key, v), { type }));
  box.append(
    field(d, 'Social image', seo.socialImage || '', (v) => update('socialImage', v), {
      options: [
        { value: '', label: 'No social image' },
        ...Object.entries(data.assets || {})
          .filter(([, a]) => a.type !== 'video')
          .map(([id, a]) => ({ value: id, label: a.alt || id })),
      ],
    }),
    field(
      d,
      'Search indexing',
      seo.noIndex ? 'hidden' : 'visible',
      (v) => update('noIndex', v === 'hidden'),
      {
        options: [
          { value: 'visible', label: 'Allow indexing' },
          { value: 'hidden', label: 'Hide from search engines' },
        ],
      },
    ),
    el(d, 'p', {
      class: 'muted',
      text: 'Review links stay hidden from search. Private page rules are controlled by your project.',
    }),
  );
  const meta = pageMetadata(doc, data);
  box.append(
    el(d, 'div', { class: 'metadata-preview' }, [
      el(d, 'strong', { text: meta.title }),
      el(d, 'p', { text: meta.description || 'Add a short description of this page.' }),
    ]),
  );
  if (adapter.openSource)
    box.append(
      button(d, 'Edit page route & navigation', () =>
        adapter.openSource({ source: 'site', path: 'settings' }),
      ),
    );
  box.append(el(d, 'h3', { text: 'Page checks' }));
  const findings = pageFindings(doc, data);
  if (!findings.length)
    box.append(el(d, 'p', { text: 'Heading structure and image descriptions are ready.' }));
  for (const finding of findings)
    box.append(button(d, finding.message, () => select?.(finding.id)));
  panel.append(box);
}

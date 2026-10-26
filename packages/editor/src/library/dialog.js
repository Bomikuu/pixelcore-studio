import { el, button, field, filePicker } from '../components/ui/index.js';
import { icon } from '../components/ui/icons.js';
import { templates, elements, sectionPresets } from '@sitebuilder/renderer';
import { previewSource, openDesignPreview } from './preview.js';
import {
  createDocument,
  cloneNode,
  validateDocument,
  walk,
  templateDocument,
  createTemplate,
  parseTemplateJSON,
  resolveValue,
  templateBranding,
  prepareContentMode,
} from '@sitebuilder/core';

export function openLibrary({
  root,
  kind = 'add',
  document,
  data = {},
  capabilities = [],
  workspace = {},
  saved = [],
  savedTemplates = [],
  onReadDesign,
  onLoadSaved,
  nextSavedOffset = null,
  onSaveTemplate,
  onManage,
  onExportTemplate,
  libraryError = '',
  onChoose,
}) {
  const d = root.ownerDocument,
    previous = root.activeElement;
  const dialog = el(d, 'dialog', {
    class: 'library-dialog',
    'aria-label': kind === 'templates' ? 'Choose a template' : 'Add to your page',
  });
  let activeTab = kind === 'templates' ? 'templates' : 'sections',
    category = 'All',
    query = '',
    selected = null,
    shown = 8,
    brandingChoice = 'keep',
    previewWindow = null,
    composer = null;
  const templateLibrary = kind === 'templates';
  let nextOffset = nextSavedOffset,
    savedSearchTimer,
    savedSearchGeneration = 0;
  const personal = savedTemplates.filter((t) => !t.archived).map(templateEntry);
  function templateEntry(t) {
    if (!t.document) return { ...t, category: 'My templates', needsLoad: true };
    const doc = templateDocument(t.document);
    return { ...t, document: doc, category: 'My templates', create: () => cloneNode(doc) };
  }
  const head = el(d, 'header', { class: 'library-heading' }, [
    el(d, 'div', {}, [
      el(d, 'h2', { text: kind === 'templates' ? 'Find your starting point' : 'Make it yours' }),
      el(d, 'p', {
        class: 'muted',
        text:
          kind === 'templates'
            ? 'Complete layouts, connected to your content.'
            : 'Finished sections and elements. Every layout adapts to mobile.',
      }),
    ]),
  ]);
  const close = () => {
    previewWindow?.close();
    clearTimeout(savedSearchTimer);
    savedSearchGeneration++;
    dialog.close?.();
    dialog.remove();
    previous?.isConnected && previous.focus?.();
  };
  const dismiss = button(d, '', close, {
    'aria-label': 'Close library',
    class: 'ui-button icon-button',
  });
  dismiss.append(icon(d, 'close'));
  const headingActions = el(d, 'div', { class: 'library-heading-actions' });
  if (templateLibrary) {
    headingActions.append(
      button(d, 'Add template', () => beginTemplate(false), {
        disabled: !onSaveTemplate,
        icon: 'add',
      }),
      button(d, 'Import JSON', () => beginTemplate(true), {
        disabled: !onSaveTemplate,
        icon: 'upload',
      }),
    );
  }
  if (onManage)
    headingActions.append(
      button(d, 'Manage saved designs', () => {
        close();
        onManage();
      }),
    );
  headingActions.append(dismiss);
  head.append(headingActions);
  const tabs = el(d, 'nav', { class: 'library-tabs', 'aria-label': 'Library type' });
  const body = el(d, 'div', { class: 'library-body' }),
    filters = el(d, 'aside', { class: 'library-filters', 'aria-label': 'Library filters' }),
    content = el(d, 'div', { class: 'library-content' });
  const results = el(d, 'div', { class: 'library-grid' }),
    detail = el(d, 'section', { class: 'library-detail', 'aria-label': 'Selected design' });
  function updateSearch(value) {
    query = value;
    shown = 8;
    draw();
    clearTimeout(savedSearchTimer);
    const token = ++savedSearchGeneration;
    const tab = activeTab;
    if (!onLoadSaved || !['my-templates', 'saved'].includes(tab)) return;
    savedSearchTimer = setTimeout(async () => {
      try {
        const page = await onLoadSaved(0, query);
        if (!dialog.isConnected || token !== savedSearchGeneration || activeTab !== tab) return;
        nextOffset = page.nextOffset;
        if (templateLibrary)
          personal.splice(0, personal.length, ...page.designs.map(templateEntry));
        else
          saved.splice(
            0,
            saved.length,
            ...page.designs.map((item) => ({ ...item, category: 'Saved', needsLoad: true })),
          );
        draw();
      } catch (error) {
        if (dialog.isConnected && token === savedSearchGeneration) {
          notice.hidden = false;
          notice.textContent = error.message;
        }
      }
    }, 250);
  }
  const search = field(d, 'Search designs', '', updateSearch);
  search
    .querySelector('input')
    .addEventListener('input', (event) => updateSearch(event.target.value));
  const notice = el(d, 'p', {
    class: libraryError ? 'error library-notice' : 'muted library-notice',
    role: libraryError ? 'alert' : 'status',
    text:
      libraryError ||
      (templateLibrary && !onSaveTemplate
        ? 'This host has not connected template storage. Built-in templates are available.'
        : ''),
  });
  notice.hidden = !notice.textContent;
  const pack = field(
    d,
    'Template pack',
    'all',
    () => {
      shown = 8;
      selected = null;
      draw();
    },
    {
      options: [
        { value: 'all', label: 'All templates' },
        { value: 'recommended', label: 'Recommended for this context' },
        { value: 'Storefront', label: 'Storefront / live catalog' },
        { value: 'Wedding', label: 'Wedding / live event' },
        { value: 'Landing page', label: 'Landing / fixed content' },
      ],
    },
  );
  if (templateLibrary)
    content.append(
      el(d, 'p', {
        class: 'muted',
        text:
          'Context: ' +
          (workspace.sourceName || document.context?.purpose || 'General website') +
          ' · ' +
          (document.mode === 'live' ? 'Live system data' : 'Fixed authored content'),
      }),
      pack,
    );
  content.append(search, notice, results, detail);
  body.append(filters, content);
  dialog.append(head, tabs, body);
  root.append(dialog);
  const entries = () =>
    activeTab === 'templates'
      ? templates
      : activeTab === 'my-templates'
        ? personal
        : activeTab === 'elements'
          ? elements
          : activeTab === 'saved'
            ? saved.filter((s) => !s.archived)
            : sectionPresets;
  const requirements = (item) => {
    const required = new Set(item.requires || (item.capability ? [item.capability] : []));
    if (item.node || item.document)
      walk(item.node || item.document, (n) => {
        if (n.type === 'products') required.add('products');
        if (n.type === 'services') required.add('services');
        if (n.type === 'event-schedule' || n.props?.text?.source === 'event') required.add('event');
        if (n.props?.widgetId?.startsWith('pixelcore.event-'))
          required.add(
            n.props.widgetId === 'pixelcore.event-rsvp'
              ? 'rsvp'
              : n.props.widgetId === 'pixelcore.event-wishes'
                ? 'wishes'
                : 'event',
          );
      });
    return [...required];
  };
  const supported = (item) => !requirements(item).some((c) => !capabilities.includes(c));
  function designDocument(item) {
    const n = item.create(data);
    return prepareContentMode(
      n.type === 'page'
        ? templateBranding(n, document, { choice: brandingChoice })
        : { ...createDocument(), theme: structuredClone(document.theme), children: [n] },
    );
  }
  function fullPreview(item) {
    previewWindow?.close();
    previewWindow = openDesignPreview({
      root,
      name: item.name,
      document: designDocument(item),
      data,
      onClose: () => {
        previewWindow = null;
      },
    });
  }
  function preview(item, large = false) {
    if (item.needsLoad)
      return el(d, 'div', { class: 'library-summary-preview', 'aria-hidden': 'true' }, [
        el(d, 'span', { class: 'library-summary-cover' }, [el(d, 'i'), el(d, 'i'), el(d, 'i')]),
        el(d, 'small', { text: 'Select to load preview' }),
      ]);
    const doc = designDocument(item);
    return el(d, 'iframe', {
      title: `${item.name} ${large ? 'preview' : 'thumbnail'}`,
      tabindex: '-1',
      sandbox: '',
      loading: 'lazy',
      class: `library-preview ${large ? 'detail-preview' : ''}`,
      srcdoc: previewSource(doc, data, { thumbnail: true }),
    });
  }
  function draw() {
    results.replaceChildren();
    filters.replaceChildren();
    tabs.replaceChildren();
    for (const [key, label] of kind === 'templates'
      ? [
          ['templates', 'Built-in'],
          ['my-templates', 'My templates'],
        ]
      : [
          ['sections', 'Sections'],
          ['elements', 'Elements'],
          ['saved', 'Saved'],
        ])
      tabs.append(
        button(
          d,
          label,
          () => {
            activeTab = key;
            savedSearchGeneration++;
            clearTimeout(savedSearchTimer);
            category = 'All';
            selected = null;
            composer = null;
            shown = 8;
            draw();
            if (query) updateSearch(query);
          },
          { 'aria-pressed': activeTab === key },
        ),
      );
    for (const name of ['All', ...new Set(entries().map((e) => e.category || 'Basics'))])
      filters.append(
        button(
          d,
          name,
          () => {
            category = name;
            selected = null;
            composer = null;
            shown = 8;
            draw();
          },
          { 'aria-pressed': category === name },
        ),
      );
    const list = entries().filter(
      (e) =>
        (category === 'All' || (e.category || 'Basics') === category) &&
        (!templateLibrary ||
          pack.querySelector('select').value === 'all' ||
          (pack.querySelector('select').value === 'recommended'
            ? supported(e) &&
              (document.context?.purpose === 'event' || workspace.kind === 'event'
                ? e.category === 'Wedding' || e.category === 'My templates'
                : document.context?.purpose === 'landing'
                  ? e.category === 'Landing page' || e.category === 'My templates'
                  : e.category !== 'Wedding')
            : e.category === pack.querySelector('select').value)) &&
        `${e.name} ${e.description || ''} ${(e.tags || []).join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    const count = el(d, 'p', {
      class: 'library-count',
      role: 'status',
      text: `${list.length} ${list.length === 1 ? 'design' : 'designs'}`,
    });
    results.append(count);
    if (!list.length)
      results.append(
        el(d, 'p', {
          class: 'empty-library',
          text:
            activeTab === 'my-templates'
              ? 'Save this page with Add template, or import a template JSON file.'
              : activeTab === 'saved'
                ? 'Save a section from its selection toolbar to reuse it here.'
                : 'No matching designs. Try a different search or category.',
        }),
      );
    for (const item of list.slice(0, shown)) {
      const available = supported(item);
      const card = button(
        d,
        '',
        () => {
          selected = item;
          composer = null;
          for (const choice of results.querySelectorAll('.library-card'))
            choice.setAttribute('aria-pressed', String(choice === card));
          drawDetail();
          if (item.needsLoad && onReadDesign) {
            const selectedItem = item;
            onReadDesign(item.id)
              .then((full) => {
                if (!dialog.isConnected || selected !== selectedItem) return;
                selected = templateLibrary
                  ? templateEntry(full)
                  : { ...full, category: 'Saved', create: () => cloneNode(full.node) };
                drawDetail();
              })
              .catch((error) => {
                if (dialog.isConnected && selected === selectedItem) {
                  detail.replaceChildren(
                    el(d, 'p', { role: 'alert', text: error.message }),
                    button(d, 'Retry preview', () => card.click()),
                  );
                }
              });
          }
        },
        {
          class: 'library-card',
          'aria-label': `Preview ${item.name}`,
          'aria-pressed': selected?.id === item.id && selected?.name === item.name,
        },
      );
      card.append(
        el(d, 'span', { class: 'library-thumbnail' }, [preview(item)]),
        el(d, 'span', { class: 'library-card-title', text: item.name }),
        el(d, 'span', {
          class: 'library-card-description',
          text: item.description || item.category || 'Responsive element',
        }),
      );
      if (!available)
        card.append(
          el(d, 'span', {
            class: 'capability-note',
            text: `Requires ${requirements(item).join(', ')} connection`,
          }),
        );
      results.append(card);
    }
    if (list.length > shown)
      results.append(
        button(
          d,
          `Show more designs (${list.length - shown})`,
          () => {
            shown += 8;
            draw();
          },
          { class: 'ui-button' },
        ),
      );
    if (onLoadSaved && nextOffset !== null && ['my-templates', 'saved'].includes(activeTab))
      results.append(
        button(d, 'Load more saved designs', async (event) => {
          event.currentTarget.disabled = true;
          try {
            const page = await onLoadSaved(nextOffset, query);
            if (!dialog.isConnected) return;
            nextOffset = page.nextOffset;
            if (templateLibrary) personal.push(...page.designs.map(templateEntry));
            else
              saved.push(
                ...page.designs.map((item) => ({ ...item, category: 'Saved', needsLoad: true })),
              );
            draw();
          } catch (error) {
            if (dialog.isConnected) {
              notice.hidden = false;
              notice.textContent = error.message;
              event.currentTarget.disabled = false;
            }
          }
        }),
      );
    drawDetail();
  }
  function drawDetail() {
    detail.replaceChildren();
    detail.hidden = !selected && !composer;
    if (composer) {
      drawComposer();
      return;
    }
    if (!selected) return;
    if (selected.needsLoad) {
      detail.append(el(d, 'p', { role: 'status', text: 'Loading selected design…' }));
      return;
    }
    const viewport = el(d, 'div', { class: 'library-detail-canvas' }, [preview(selected, true)]);
    detail.append(
      el(d, 'h3', { text: selected.name }),
      el(d, 'p', { class: 'muted', text: selected.description || 'Responsive, editable layout.' }),
      button(d, 'Open full-page preview', () => fullPreview(selected), { icon: 'preview' }),
      viewport,
    );
    if (templateLibrary) {
      const brand = field(
        d,
        'Template branding',
        brandingChoice,
        (value) => {
          brandingChoice = value;
          drawDetail();
          detail.querySelector('[data-template-branding] select')?.focus();
        },
        {
          options: [
            { value: 'keep', label: 'Keep current colors and global fonts' },
            { value: 'template', label: 'Use template colors · keep global fonts' },
          ],
        },
      );
      brand.setAttribute('data-template-branding', '');
      detail.append(
        brand,
        el(d, 'p', {
          class: 'muted',
          text:
            designDocument(selected).mode === 'live'
              ? 'Live content · connected sections update from your system. Applying this layout enables Live data.'
              : 'Fixed content · authored page body. Shared branding and site regions can update separately.',
        }),
      );
      const sections = selected.create(data).children.filter((n) => n.type === 'section');
      detail.append(
        el(d, 'p', {
          class: 'muted',
          text:
            'Includes: Header · ' +
            sections.map((n) => n.props.name || 'Section').join(' · ') +
            ' · Footer with contact and connected social links.',
        }),
      );
    }
    const requiredFields = [];
    walk(selected.create(data), (n) => {
      for (const value of Object.values(n.props || {}))
        if (value && typeof value === 'object' && value.source && value.source !== 'item')
          requiredFields.push({
            name: value.source + '.' + value.path,
            available: resolveValue(value, data) !== undefined,
          });
    });
    detail.append(
      el(d, 'p', {
        class: 'muted',
        text:
          'Required features: ' +
          (requirements(selected).join(', ') || 'Basic content and media') +
          '. ' +
          (supported(selected)
            ? 'Compatible with this workspace.'
            : 'Unavailable features must be enabled in the host.'),
      }),
    );
    if (requiredFields.length)
      detail.append(
        el(
          d,
          'ul',
          {},
          [...new Map(requiredFields.map((v) => [v.name, v])).values()].map((value) =>
            el(d, 'li', {
              text:
                value.name +
                ' · ' +
                (value.available
                  ? 'Connected'
                  : 'Missing in preview; uses fallback or empty content'),
            }),
          ),
        ),
      );
    if (requirements(selected).includes('rsvp'))
      detail.append(
        el(d, 'p', {
          class: 'muted',
          text: 'RSVP is a native host widget. Invitation, guest limits, deadlines and response permissions stay in PixelCore. Review previews cannot submit responses.',
        }),
      );
    if (templateLibrary)
      detail.append(
        el(d, 'p', {
          class: 'muted',
          text: 'Uses this website’s primary and secondary fonts. Replaces this page’s content in one undoable change. Existing host-managed header and footer remain. System records and older revisions are preserved.',
        }),
      );
    const placement = field(d, 'Insert position', 'after', () => {}, {
      options: [
        { value: 'after', label: 'Below selection' },
        { value: 'inside', label: 'Inside selected container' },
        { value: 'end', label: 'End of page' },
      ],
    });
    if (!templateLibrary) detail.append(placement);
    const available = supported(selected);
    detail.append(
      button(
        d,
        templateLibrary ? 'Apply to this page' : 'Insert design',
        () => {
          const value = templateLibrary ? designDocument(selected) : selected.create(data);
          if (value.type === 'page') validateDocument(value);
          onChoose(value, {
            replace: templateLibrary,
            position: placement.querySelector('select').value,
          });
          close();
        },
        { class: 'ui-button primary', disabled: !available },
      ),
    );
    if (templateLibrary && onExportTemplate)
      detail.append(
        button(d, 'Export template JSON', () => {
          try {
            onExportTemplate(
              createTemplate({
                name: selected.name,
                description: selected.description || '',
                document: selected.create(data),
              }),
            );
          } catch (e) {
            notice.textContent = e.message;
            notice.className = 'error library-notice';
            notice.hidden = false;
          }
        }),
      );
    if (!available)
      detail.append(
        el(d, 'p', {
          class: 'capability-note',
          text: 'Connect the required source in Site settings to use this design.',
        }),
      );
  }
  function beginTemplate(importing) {
    if (composer?.saving) return;
    composer = {
      importing,
      name: importing ? '' : document.title,
      description: '',
      document: importing ? null : templateDocument(document),
      error: '',
      saving: false,
      filename: '',
    };
    selected = null;
    drawDetail();
    detail.scrollIntoView?.({ block: 'nearest' });
    detail.querySelector('input')?.focus();
  }
  function drawComposer() {
    const state = composer;
    detail.append(
      el(d, 'h3', { text: state.importing ? 'Import a template' : 'Save this page as a template' }),
      el(d, 'p', {
        class: 'muted',
        text: 'Reusable across your business’s pages. Connected sections use the destination page’s data and global font pair. Media must exist in the destination library.',
      }),
    );
    if (state.importing)
      detail.append(
        filePicker(d, 'Template JSON file', async (file) => {
          if (!file || state.saving) return;
          const selection = {};
          state.reading = selection;
          state.document = null;
          state.error = '';
          state.filename = file.name;
          drawDetail();
          try {
            if (file.size > 550000)
              throw new Error('Choose a template JSON file smaller than 550 KB.');
            const imported = parseTemplateJSON(await file.text());
            if (composer !== state || state.reading !== selection || !dialog.isConnected) return;
            Object.assign(state, imported);
          } catch (e) {
            if (composer !== state || state.reading !== selection || !dialog.isConnected) return;
            state.error = e.message;
          }
          state.reading = null;
          drawDetail();
        }),
      );
    if (state.reading)
      detail.append(el(d, 'p', { class: 'muted', role: 'status', text: 'Reading template JSON…' }));
    if (state.filename) detail.append(el(d, 'p', { class: 'muted', text: state.filename }));
    const name = field(d, 'Template name', state.name, (v) => (state.name = v));
    const description = field(
      d,
      'Description (optional)',
      state.description,
      (v) => (state.description = v),
      { type: 'textarea' },
    );
    name.querySelector('input').maxLength = 100;
    description.querySelector('textarea').maxLength = 300;
    detail.append(name, description);
    if (state.document) {
      detail.append(
        el(d, 'div', { class: 'library-detail-canvas' }, [
          preview(
            {
              name: state.name || 'Imported template',
              create: () => structuredClone(state.document),
            },
            true,
          ),
        ]),
      );
      detail.append(
        button(
          d,
          'Open full-page preview',
          () =>
            fullPreview({
              name: state.name || 'Imported template',
              create: () => structuredClone(state.document),
            }),
          { icon: 'preview' },
        ),
      );
    }
    const error = el(d, 'p', { class: 'error', role: 'alert', text: state.error });
    const actions = el(d, 'div', { class: 'dialog-actions' });
    const save = button(
      d,
      state.saving ? 'Saving…' : 'Save template',
      async () => {
        if (state.saving || state.reading) return;
        state.name = name.querySelector('input').value;
        state.description = description.querySelector('textarea').value;
        try {
          if (!state.document) throw new Error('Choose a valid template JSON file first.');
          const value = createTemplate(state);
          state.saving = true;
          save.disabled = true;
          cancel.disabled = true;
          save.textContent = 'Saving…';
          const saved = await onSaveTemplate(value.name, value.document, value.description);
          if (!dialog.isConnected || composer !== state) return;
          const entry = templateEntry(saved);
          personal.unshift(entry);
          composer = null;
          selected = entry;
          activeTab = 'my-templates';
          category = 'All';
          query = '';
          shown = 8;
          search.querySelector('input').value = '';
          notice.textContent = 'Template saved. Preview it, then apply it when you’re ready.';
          notice.className = 'muted library-notice';
          notice.setAttribute('role', 'status');
          notice.hidden = false;
          draw();
        } catch (e) {
          state.error = e.message;
          state.saving = false;
          error.textContent = e.message;
          save.disabled = false;
          cancel.disabled = false;
          save.textContent = 'Save template';
        }
      },
      { class: 'ui-button primary', disabled: state.saving || !state.document },
    );
    const cancel = button(
      d,
      'Cancel template',
      () => {
        composer = null;
        drawDetail();
      },
      { disabled: state.saving },
    );
    actions.append(cancel, save);
    detail.append(error, actions);
  }
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  draw();
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute('open', '');
  dismiss.focus();
  return { close, element: dialog };
}

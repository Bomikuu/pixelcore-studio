import { el, button, field } from '../components/ui/index.js';
import { applyTemplate, templates } from '@sitebuilder/renderer';
import { liveContentNodes, templateBranding } from '@sitebuilder/core';
export function openContext({ root, document, data = {}, workspace = {}, brandKit, onApply }) {
  const d = root.ownerDocument,
    previous = root.activeElement;
  const dialog = el(d, 'dialog', { class: 'context-dialog', 'aria-label': 'Set up your website' });
  let step = 0;
  const state = {
    purpose: document.context?.purpose || workspace.purpose || 'storefront',
    mode: liveContentNodes(document, data).length
      ? 'live'
      : document.context?.setupComplete
        ? document.mode
        : (document.context?.purpose || workspace.purpose) === 'landing'
          ? 'fixed'
          : 'live',
    template: 'continue',
    brand: 'keep',
  };
  const body = el(d, 'div', { class: 'context-body' }),
    error = el(d, 'p', { class: 'error', role: 'alert', tabindex: '-1' }),
    actions = el(d, 'div', { class: 'dialog-actions' });
  const close = () => {
    dialog.close?.();
    dialog.remove();
    previous?.focus?.();
  };
  function draw() {
    body.replaceChildren();
    actions.replaceChildren();
    error.textContent = '';
    body.append(
      el(d, 'p', { class: 'context-progress', text: `Website setup · ${step + 1} of 3` }),
      el(d, 'h2', {
        text: ['What are you creating?', 'Choose your starting point', 'Make it feel like you'][
          step
        ],
      }),
    );
    if (step === 0) {
      body.append(
        el(d, 'p', {
          class: 'muted',
          text: workspace.sourceName
            ? `Connected to ${workspace.sourceName}. This uses your existing system records.`
            : 'Choose a purpose. This example workspace uses labeled sample records.',
        }),
      );
      body.append(
        field(
          d,
          'Website purpose',
          state.purpose,
          (v) => {
            state.purpose = v;
            state.mode = v === 'landing' ? 'fixed' : 'live';
            state.template = 'continue';
          },
          {
            options:
              workspace.kind === 'layout'
                ? [{ value: 'storefront', label: 'Site-wide layout' }]
                : workspace.kind === 'event'
                  ? [{ value: 'event', label: 'Wedding / event' }]
                  : workspace.kind === 'page'
                    ? [
                        { value: 'storefront', label: 'Storefront' },
                        { value: 'landing', label: 'Landing / information' },
                      ]
                    : [
                        { value: 'storefront', label: 'Storefront' },
                        { value: 'event', label: 'Wedding / event' },
                        { value: 'landing', label: 'Landing / information' },
                      ],
          },
        ),
      );
      body.append(
        field(
          d,
          'Content',
          state.mode,
          (v) => {
            state.mode = v;
            state.template = 'continue';
          },
          {
            options: [
              { value: 'live', label: 'Live data — current catalog and event details' },
              { value: 'fixed', label: 'Fixed content — authored landing page copy' },
            ],
          },
        ),
        el(d, 'p', {
          class: 'muted',
          text: 'Fixed content is an authored page body. Live sections keep their system connections. Shared branding, headers and footers can update in either mode.',
        }),
      );
      if (workspace.changeSource)
        body.append(
          button(d, 'Choose a different source', () => {
            close();
            workspace.changeSource();
          }),
        );
    }
    if (step === 1)
      body.append(
        field(d, 'Start with', state.template, (v) => (state.template = v), {
          options: [
            { value: 'continue', label: 'Continue this page and its current content' },
            ...templates
              .filter(
                (item) =>
                  item.category ===
                    (state.purpose === 'event'
                      ? 'Wedding'
                      : state.purpose === 'landing'
                        ? 'Landing page'
                        : 'Storefront') &&
                  (item.requires || []).every((capability) =>
                    (workspace.features || []).includes(capability),
                  ),
              )
              .map((item) => ({
                value: item.id,
                label:
                  item.name +
                  (item.mode === state.mode
                    ? ' — complete website'
                    : ' — requires ' + item.mode + ' content'),
                disabled: item.mode !== state.mode,
              })),
            { value: 'blank', label: 'Start with a blank page' },
          ],
        }),
        el(d, 'p', {
          class: 'muted',
          text: 'A new layout replaces this draft only. Your live publication and source records stay available.',
        }),
      );
    if (step === 2) {
      body.append(
        field(d, 'Branding', state.brand, (v) => (state.brand = v), {
          options: [
            { value: 'keep', label: 'Keep this page’s colors and fonts' },
            { value: 'template', label: 'Use template colors · keep global fonts' },
            { value: 'import', label: 'Import connected business branding', disabled: !brandKit },
          ],
        }),
        ...(!brandKit
          ? [
              el(d, 'p', {
                class: 'muted',
                text: 'This workspace has no connected brand kit to import.',
              }),
            ]
          : []),
        el(d, 'p', {
          class: 'muted',
          text: `Available features: ${(workspace.features || []).join(', ') || 'text, media and layout'}. You can add sections after setup.`,
        }),
      );
    }
    actions.append(button(d, 'Cancel', close));
    if (step > 0)
      actions.append(
        button(d, 'Back', () => {
          step--;
          draw();
        }),
      );
    actions.append(
      button(
        d,
        step === 2 ? 'Open studio' : 'Continue',
        () => {
          if (step < 2) {
            step++;
            draw();
            return;
          }
          error.textContent = '';
          try {
            const candidate =
              state.template === 'continue'
                ? structuredClone(document)
                : state.template === 'blank'
                  ? { ...structuredClone(document), children: [] }
                  : applyTemplate(state.template, data);
            const next = templateBranding(candidate, document, { choice: state.brand, brandKit });
            next.id = document.id;
            next.title = document.title;
            next.mode = state.mode;
            next.context = {
              version: 1,
              purpose: state.purpose,
              sourceId: workspace.sourceId || '',
              setupComplete: 1,
            };
            if (workspace.kind === 'layout') next.children = structuredClone(document.children);
            if (workspace.regions?.some((r) => r.owner === 'host'))
              next.children = next.children.filter((n) => !['header', 'footer'].includes(n.type));
            if (next.mode === 'fixed' && liveContentNodes(next, data).length)
              throw new Error(
                'This layout has live sections or connected fields. Choose Live data, start with an authored template, or remove those connections before switching to fixed content.',
              );
            onApply(next);
            close();
          } catch (cause) {
            error.textContent = cause.message;
            error.focus();
          }
        },
        { class: 'ui-button primary' },
      ),
    );
  }
  dialog.append(body, error, actions);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  root.append(dialog);
  draw();
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute('open', '');
  actions.firstElementChild.focus();
  return { close };
}

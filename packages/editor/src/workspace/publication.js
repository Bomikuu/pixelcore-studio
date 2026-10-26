import { renderPage } from '@sitebuilder/renderer';
import { publicationFindings, revisionSummary } from '@sitebuilder/core';
import { el, button, modal } from '../components/ui/index.js';
export function openPublication({ root, document, data, adapter, onPublish, onSelect, onHistory }) {
  const d = root.ownerDocument;
  const findings = publicationFindings(document, data, adapter.capabilities);
  if (adapter.workspace?.rsvpState === 'disabled')
    for (const finding of findings.filter((f) => f.kind === 'rsvp')) {
      finding.level = 'blocker';
      finding.message =
        'RSVP is disabled for this event. Enable it in PixelCore or remove the widget.';
    }
  const parsed = d.createElement('template');
  parsed.innerHTML = renderPage(document, data, { mode: 'public' }).html;
  for (const link of parsed.content.querySelectorAll('a[href^="#"]')) {
    const target = link.getAttribute('href').slice(1);
    if (target && ![...parsed.content.querySelectorAll('[id]')].some((node) => node.id === target))
      findings.push({
        id: link.closest('[data-wb-id]')?.getAttribute('data-wb-id') || document.id,
        level: 'warning',
        kind: 'link',
        message: 'Page link #' + target + ' has no destination.',
      });
  }
  const blockers = findings.filter((f) => f.level === 'blocker');
  const body = el(d, 'div', { class: 'publication-readiness' }),
    summary = el(d, 'p', { role: 'status', text: 'Checking the saved publication…' });
  body.append(
    el(d, 'p', {
      text: 'Review your current draft, then publish. Live records continue to come from your system.',
    }),
    summary,
    el(d, 'p', {
      class: 'muted',
      text:
        adapter.workspace?.kind === 'layout'
          ? 'Global header/footer affects: ' + (adapter.workspace.affectedPages || []).join(', ')
          : 'This publishes this page. Linked sections retain their own publication workflow.',
    }),
  );
  if (adapter.workspace?.publicUrl)
    body.append(
      el(d, 'a', {
        href: adapter.workspace.publicUrl,
        text: 'Open live destination',
        target: '_blank',
        rel: 'noopener',
      }),
    );
  const dialog = modal(
    root,
    'Review & publish',
    body,
    async () => {
      if (blockers.length)
        throw new Error(
          'Fix missing media, unavailable widgets or content-mode blockers before publishing.',
        );
      await onPublish();
    },
    { confirmLabel: 'Publish' },
  );
  dialog.element.classList.add('publication-dialog');
  body.append(
    el(d, 'h3', {
      text: `${blockers.length} blockers · ${findings.length - blockers.length} warnings`,
    }),
  );
  if (!findings.length)
    body.append(el(d, 'p', { text: 'No issues found by the available automated checks.' }));
  for (const finding of findings)
    body.append(
      button(
        d,
        (finding.level === 'blocker' ? 'Fix: ' : 'Review: ') + finding.message,
        () => {
          dialog.close();
          onSelect(finding.id);
        },
        { class: 'ui-button readiness-finding ' + (finding.level === 'blocker' ? 'error' : '') },
      ),
    );
  body.append(
    el(d, 'p', {
      class: 'muted',
      text:
        document.analytics?.provider && document.analytics.provider !== 'none'
          ? 'Analytics is configured. Collection requires each visitor’s consent and a matching live domain.'
          : 'Analytics is not configured. This does not prevent publication.',
    }),
    el(d, 'p', {
      class: 'muted',
      text: 'Publish acknowledges the listed warnings. These checks do not certify accessibility or replace your host’s authorization.',
    }),
  );
  if (adapter.listRevisions && adapter.readRevision) {
    body.append(
      button(d, 'Compare layouts in history', () => {
        dialog.close();
        onHistory();
      }),
    );
    const load = async () => {
      try {
        const rows = await adapter.listRevisions();
        const live = rows.find((r) => r.isPublished);
        const revision = live ? await adapter.readRevision(live.id) : null;
        if (dialog.element.isConnected)
          summary.textContent = revisionSummary(document, revision?.document);
      } catch (error) {
        if (dialog.element.isConnected) {
          summary.textContent = 'Could not compare with live: ' + error.message;
          body.append(button(d, 'Retry live comparison', load));
        }
      }
    };
    load();
  } else summary.textContent = 'This host does not expose live comparison.';
  return dialog;
}

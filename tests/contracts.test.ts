import { createDocument, applyOperation } from '@sitebuilder/core';
import { renderPage } from '@sitebuilder/renderer';
import { mountEditor, createDjangoAdapter } from '@sitebuilder/editor';
const document = createDocument({ mode: 'live' });
renderPage(document, { event: { title: 'Launch' } }, { mode: 'review' });
applyOperation(document, { type: 'theme', value: { colors: { primary: '#125b50' } } });
const adapter = createDjangoAdapter({ websiteId: 'example' });
void (() => mountEditor(globalThis.document.createElement('div'), { document, adapter }));
// @ts-expect-error Unknown content mode is not part of the contract.
createDocument({ mode: 'anything' });
// @ts-expect-error Moves require an explicit destination parent.
applyOperation(document, { type: 'move', id: 'element' });

// @ts-expect-error Font families can only be changed through the global theme.
applyOperation(document, { type: 'style', id: 'element', value: { fontFamily: 'Arial' } });
void adapter.listTemplates?.();
void adapter.saveTemplate?.('A reusable page', document, 'A short description');

void (() =>
  mountEditor(globalThis.document.createElement('div'), {
    document,
    adapter,
    appearance: 'light',
  }).select(document.id, { focus: 'inspector', reveal: true }));
void (() =>
  mountEditor(globalThis.document.createElement('div'), {
    document,
    adapter,
    // @ts-expect-error Only two editor appearances are supported.
    appearance: 'sepia',
  }));

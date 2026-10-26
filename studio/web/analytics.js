import { loadingState } from './states.js';
import { el, button, field, modal } from '../../packages/editor/src/components/ui/index.js';
import { validateAnalytics } from '@sitebuilder/core';
import { actionLink } from './shell.js';
export async function mountAnalytics(region, { client, workspace, websiteId }) {
  const d = region.ownerDocument,
    w = d.defaultView;
  let alive = true,
    busy = false,
    dirty = false;
  region.replaceChildren(
    el(d, 'div', { class: 'studio-intro' }, [
      el(d, 'div', {}, [
        el(d, 'h1', { text: 'Know what brings people in.' }),
        el(d, 'p', {
          class: 'muted',
          text: 'Connect a provider, publish your setup and verify real traffic on your live website.',
        }),
      ]),
    ]),
  );
  if (!workspace.sites.length && !websiteId) {
    region.append(
      el(d, 'p', { text: 'Save a website in the builder before setting up analytics.' }),
      actionLink(d, 'Open builder', '/studio/builder'),
    );
    return {
      destroy() {
        alive = false;
      },
    };
  }
  const selected =
    workspace.sites.find((s) => s.id === websiteId) ||
    (websiteId ? { id: websiteId, title: 'Selected website' } : workspace.sites[0]);
  const choices = workspace.sites.some((site) => site.id === selected.id)
    ? workspace.sites
    : [selected, ...workspace.sites];
  region.append(
    field(
      d,
      'Website',
      selected.id,
      (value) => {
        w.location.href = '/studio/analytics?site=' + encodeURIComponent(value);
      },
      { options: choices.map((s) => ({ value: s.id, label: s.title })) },
    ),
  );
  const loading = loadingState(d, {
    title: 'Loading analytics setup…',
    description: 'Checking the saved configuration for this website.',
    compact: true,
  });
  region.append(loading.element);
  let setup = await client.send(`workspace/analytics/${selected.id}/`);
  loading.element.remove();
  const feedback = el(d, 'p', { class: 'studio-feedback', role: 'status', hidden: true }),
    badge = el(d, 'p', { class: 'studio-state', text: setup.status });
  const message = (text, error = false) => {
    if (!alive) return;
    feedback.hidden = false;
    feedback.textContent = text;
    feedback.classList.toggle('error', error);
    feedback.setAttribute('role', error ? 'alert' : 'status');
  };
  const input = el(d, 'div'),
    configForm = el(d, 'form', { class: 'studio-form-section', novalidate: '' });
  let provider = setup.draft.provider;
  let domain, tag, url;
  const renderFields = (config = {}) => {
    input.replaceChildren();
    if (provider === 'none') return;
    domain = field(d, 'Public domain', config.domain || '', () => {});
    input.append(domain);
    if (provider === 'google') {
      tag = field(d, 'Google tag ID', config.measurementId || '', () => {});
      input.append(
        tag,
        el(d, 'p', {
          class: 'muted',
          text: 'Copy the tag ID from your Google Analytics web data stream, for example G-XXXXXXXXXX.',
        }),
      );
    } else {
      url = field(d, 'Plausible script URL', config.scriptUrl || '', () => {}, { type: 'url' });
      input.append(
        url,
        el(d, 'p', {
          class: 'muted',
          text: 'Copy only the script src URL from your site’s Plausible installation instructions. Do not paste HTML.',
        }),
      );
    }
  };
  const choose = field(
    d,
    'Analytics provider',
    provider,
    (value) => {
      provider = value;
      dirty = true;
      renderFields(setup.draft.provider === value ? setup.draft : {});
      const dashboard = region.querySelector('[data-provider-dashboard]');
      if (dashboard)
        dashboard.href =
          value === 'google' ? 'https://analytics.google.com/' : 'https://plausible.io/sites';
    },
    {
      options: [
        { value: 'none', label: 'Not connected' },
        { value: 'google', label: 'Google Analytics' },
        { value: 'plausible', label: 'Plausible' },
      ],
    },
  );
  renderFields(setup.draft);
  const path = `workspace/analytics/${selected.id}/`;
  const act = async (control, fn) => {
    if (busy) return;
    busy = true;
    const controls = [...configForm.querySelectorAll('button,input,select')];
    controls.forEach((c) => (c.disabled = true));
    try {
      await fn();
      if (alive) {
        badge.textContent = setup.status;
      }
    } catch (error) {
      message(error.message, true);
    } finally {
      busy = false;
      if (alive) {
        controls.forEach((c) => (c.disabled = false));
        sync();
      }
    }
  };
  const save = button(
    d,
    'Save configuration',
    (e) => {
      e.preventDefault();
      return act(e.currentTarget, async () => {
        const config = validateAnalytics(
          provider === 'none'
            ? { provider: 'none' }
            : {
                provider,
                domain: domain.querySelector('input').value.trim(),
                ...(provider === 'google'
                  ? { measurementId: tag.querySelector('input').value.trim() }
                  : { scriptUrl: url.querySelector('input').value.trim() }),
              },
        );
        setup = await client.send(path, {
          method: 'PUT',
          body: { config, expectedVersion: setup.version },
        });
        dirty = false;
        message('Configuration saved as a draft. Publish when you are ready.');
      });
    },
    { class: 'ui-button primary', icon: 'save', type: 'submit' },
  );
  const publish = button(
    d,
    'Publish configuration',
    () => {
      const owner = region.getRootNode();
      modal(
        owner.host ? owner : region,
        'Publish website and analytics?',
        el(d, 'p', {
          text: 'The current saved layout, content and analytics configuration will become public. Public tracking still follows your host consent policy.',
        }),
        async () => {
          setup = await client.send(path, {
            method: 'POST',
            body: { action: 'publish', expectedVersion: setup.version },
          });
          badge.textContent = setup.status;
          sync();
          message('Published. Follow the provider guide to verify your live website.');
        },
        { confirmLabel: 'Publish website' },
      );
    },
    { icon: 'publish' },
  );
  const confirm = button(
    d,
    'I verified visits in my provider',
    (e) =>
      act(e.currentTarget, async () => {
        setup = await client.send(path, { method: 'POST', body: { action: 'confirm' } });
        message(
          'Your confirmation is saved. Studio has not independently verified provider traffic.',
        );
      }),
    { icon: 'check' },
  );
  function sync() {
    publish.disabled = dirty;
    confirm.disabled = dirty || !setup.publishedRevision || setup.published.provider === 'none';
  }
  configForm.append(
    el(d, 'h2', { text: 'Connection' }),
    badge,
    choose,
    input,
    el(d, 'div', { class: 'studio-actions' }, [save, publish]),
    el(d, 'p', {
      class: 'muted',
      text: 'Publishing applies the current saved website draft, including its layout. Unsaved settings must be saved first.',
    }),
    el(d, 'p', {
      class: 'studio-feedback',
      text: setup.consentAvailable
        ? 'Visitor consent is connected. Analytics loads only after a visitor allows it on a matching public domain. Visitors can decline or withdraw their choice.'
        : 'Waiting for host consent integration. Studio stores your setup and keeps tracking disabled until it is connected.',
    }),
    el(d, 'h2', { text: 'Verify your installation' }),
    el(d, 'p', {
      class: 'muted',
      text: 'Open your published website and check the provider’s realtime or installation verification tool. An entered ID does not prove that visits are being received.',
    }),
    confirm,
  );
  configForm.addEventListener('input', () => {
    dirty = true;
    sync();
  });
  configForm.addEventListener('change', sync);
  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    save.click();
  });
  const steps = el(d, 'aside', { class: 'studio-help' }, [
    el(d, 'h2', { text: 'From setup to real visits' }),
    el(d, 'ol', { class: 'studio-steps' }, [
      el(d, 'li', {}, [
        el(d, 'div', {}, [
          el(d, 'strong', { text: 'Create your provider’s site' }),
          el(d, 'p', {
            text: 'Choose a Google Analytics web data stream or add your domain in Plausible.',
          }),
        ]),
      ]),
      el(d, 'li', {}, [
        el(d, 'div', {}, [
          el(d, 'strong', { text: 'Save, review and publish' }),
          el(d, 'p', {
            text: 'Use the exact provider configuration. Ask your platform administrator to connect its public consent policy.',
          }),
        ]),
      ]),
      el(d, 'li', {}, [
        el(d, 'div', {}, [
          el(d, 'strong', { text: 'Verify on the live website' }),
          el(d, 'p', {
            text: 'Check Google Realtime / DebugView or Plausible’s installation verifier. Confirm only after visits are received.',
          }),
        ]),
      ]),
    ]),
    el(d, 'p', {}, [
      el(d, 'a', {
        href: 'https://support.google.com/analytics/answer/14183469?hl=en',
        target: '_blank',
        rel: 'noopener',
        text: 'Google Analytics setup guide',
      }),
    ]),
    el(d, 'p', {}, [
      el(d, 'a', {
        href: 'https://plausible.io/docs/plausible-script',
        target: '_blank',
        rel: 'noopener',
        text: 'Plausible installation guide',
      }),
    ]),
    el(d, 'p', {}, [
      el(d, 'a', {
        href:
          provider === 'google' ? 'https://analytics.google.com/' : 'https://plausible.io/sites',
        target: '_blank',
        rel: 'noopener',
        text: 'Open provider dashboard',
        'data-provider-dashboard': '',
      }),
    ]),
    el(d, 'p', {
      text: 'Reports live in your provider. Studio does not display sample visitor counts or claim a connection from a link click.',
    }),
  ]);
  region.append(feedback, el(d, 'div', { class: 'studio-form-layout' }, [configForm, steps]));
  sync();
  const unload = (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  w.addEventListener('beforeunload', unload);
  return {
    get hasUnsavedChanges() {
      return dirty;
    },
    destroy() {
      alive = false;
      w.removeEventListener('beforeunload', unload);
      region.replaceChildren();
    },
  };
}

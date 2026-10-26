import { el } from '../../packages/editor/src/components/ui/index.js';
export async function connectPlatform({
  root,
  client,
  platform,
  onConnected,
  onChoices = () => {},
  onStatus = () => {},
  signal,
  popupWindow,
}) {
  const d = root.ownerDocument,
    w = d.defaultView;
  const pending = await client.send('connect/begin/', {
    method: 'POST',
    body: { platformId: platform.id },
    signal,
  });
  if (signal?.aborted) {
    popupWindow?.close();
    return () => {};
  }
  const url = new URL(pending.frameUrl);
  if (url.origin !== platform.origin)
    throw new Error('The platform returned an unexpected connection origin.');
  const frame = el(d, 'iframe', {
    src: url.href,
    title: `Connect ${platform.name}`,
    hidden: true,
    referrerpolicy: 'no-referrer',
  });
  if (popupWindow) popupWindow.location.href = url.href;
  let active = true,
    completing = false;
  const cleanup = () => {
    active = false;
    w.clearTimeout(timeout);
    w.removeEventListener('message', receive);
    signal?.removeEventListener('abort', cleanup);
    frame.remove();
    popupWindow?.close();
  };
  const choose = (businessId) => {
    if (active)
      (popupWindow || frame.contentWindow)?.postMessage(
        { type: 'studio:select', state: pending.state, businessId },
        url.origin,
      );
  };
  const receive = async (event) => {
    const value = event.data;
    if (
      !active ||
      event.source !== (popupWindow || frame.contentWindow) ||
      event.origin !== url.origin ||
      value?.type !== 'studio:connect' ||
      value.version !== 1 ||
      value.state !== pending.state
    )
      return;
    if (value.status === 'choices') {
      if (!Array.isArray(value.businesses) || value.businesses.length > 100) return;
      w.clearTimeout(timeout);
      onChoices(
        value.businesses.filter((v) => typeof v.id === 'string' && typeof v.name === 'string'),
        choose,
      );
    } else if (
      value.status === 'connected' &&
      typeof value.code === 'string' &&
      value.code.length < 200 &&
      !completing
    ) {
      completing = true;
      try {
        const session = await client.send('connect/complete/', {
          method: 'POST',
          body: { platformId: platform.id, state: pending.state, code: value.code },
          signal,
        });
        if (active) {
          cleanup();
          onConnected(session);
        }
      } catch (error) {
        if (active) {
          onStatus(error.message);
          cleanup();
        }
      }
    } else if (['signed-out', 'unavailable'].includes(value.status)) {
      onStatus(
        value.status === 'signed-out'
          ? `Sign in to ${platform.name}, then choose Connect.`
          : `${platform.name} is unavailable. Your Studio login is still available.`,
      );
      cleanup();
    }
  };
  w.addEventListener('message', receive);
  const timeout = w.setTimeout(() => {
    if (active) {
      onStatus(`${platform.name} could not be reached. You can retry or use your Studio account.`);
      cleanup();
    }
  }, 12000);
  signal?.addEventListener('abort', cleanup, { once: true });
  if (!popupWindow) root.append(frame);
  return cleanup;
}

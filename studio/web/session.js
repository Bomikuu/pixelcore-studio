export function createStudioClient({
  fetcher = globalThis.fetch,
  document = globalThis.document,
} = {}) {
  async function send(path, { method = 'GET', body, form, signal } = {}) {
    const token = decodeURIComponent(
      document.cookie
        .split('; ')
        .find((v) => v.startsWith('studio_csrftoken='))
        ?.split('=')
        .slice(1)
        .join('=') || '',
    );
    const response = await fetcher('/api/studio/' + path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(!['GET', 'HEAD'].includes(method) ? { 'X-CSRFToken': token } : {}),
      },
      ...(form ? { body: form } : body ? { body: JSON.stringify(body) } : {}),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok)
      throw Object.assign(
        new Error(value.error?.message || 'The request could not complete. Try again.'),
        { status: response.status, code: value.error?.code },
      );
    return value;
  }
  return {
    send,
    session: () => send('session/'),
    signOut: () => send('session/', { method: 'DELETE' }),
  };
}

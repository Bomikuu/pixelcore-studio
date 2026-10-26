export function createJsonClient({
  baseUrl = '/api/website-builder/',
  request,
  fetch: fetcher = globalThis.fetch,
  csrfCookieName = 'csrftoken',
} = {}) {
  const cookie = () =>
    typeof document === 'undefined'
      ? ''
      : decodeURIComponent(
          document.cookie
            .split('; ')
            .find((v) => v.startsWith(csrfCookieName + '='))
            ?.split('=')
            .slice(1)
            .join('=') || '',
        );
  const send = async (path, { method = 'GET', body } = {}) => {
    if (request) {
      try {
        if (method !== 'GET' && !cookie()) await request(`${baseUrl}csrf/`);
        return await request(`${baseUrl}${path}`, {
          method,
          ...(body ? { body } : {}),
          ...(method !== 'GET' ? { headers: { 'X-CSRFToken': cookie() } } : {}),
        });
      } catch (e) {
        const error = e?.data?.error;
        if (error)
          throw Object.assign(new Error(error.message || 'The request failed.'), {
            code: error.code,
            status: e.response?.status,
            cause: e,
          });
        throw e;
      }
    }
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
    if (method !== 'GET' && !cookie()) await fetcher(`${baseUrl}csrf/`, { credentials: 'include' });
    let response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
          ...(method !== 'GET' ? { 'X-CSRFToken': cookie() } : {}),
        },
        ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
      });
    } catch (e) {
      throw Object.assign(new Error('The server cannot be reached. Your edits are retained.'), {
        code: 'OFFLINE',
        cause: e,
      });
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw Object.assign(
        new Error(result.error?.message || `Request failed (${response.status}).`),
        { code: result.error?.code || 'HTTP_ERROR', status: response.status },
      );
    return result;
  };
  return { send };
}

export function validateAnalytics(value) {
  if (value === undefined) return { provider: 'none', domain: '' };
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (k) => !['provider', 'domain', 'measurementId', 'scriptUrl'].includes(k),
    )
  )
    throw new Error('Invalid analytics configuration.');
  if (!['none', 'google', 'plausible'].includes(value.provider))
    throw new Error('Choose a supported analytics provider.');
  if (value.provider === 'none') return { provider: 'none', domain: '' };
  if (
    typeof value.domain !== 'string' ||
    value.domain.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value.domain)
  )
    throw new Error('Enter a public domain such as example.com, without a URL or path.');
  if (value.provider === 'google') {
    if (
      typeof value.measurementId !== 'string' ||
      !/^(G|AW)-[A-Z0-9]{4,32}$/.test(value.measurementId)
    )
      throw new Error('Enter the Google tag ID from your web data stream.');
    return { provider: 'google', domain: value.domain, measurementId: value.measurementId };
  }
  if (
    typeof value.scriptUrl !== 'string' ||
    !/^https:\/\/plausible\.io\/js\/[a-zA-Z0-9._-]{1,120}\.js$/.test(value.scriptUrl)
  )
    throw new Error(
      'Use the HTTPS plausible.io/js/ script URL provided by your site installation instructions.',
    );
  return { provider: 'plausible', domain: value.domain, scriptUrl: value.scriptUrl };
}

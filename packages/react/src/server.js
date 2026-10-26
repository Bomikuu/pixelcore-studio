import { createElement } from 'react';
import { renderPage } from '@sitebuilder/renderer';
export function WebsitePage({
  document,
  data = {},
  mode = 'public',
  baseUrl = '',
  landmark = true,
}) {
  return createElement('div', {
    'data-website-host': 'react',
    dangerouslySetInnerHTML: {
      __html: renderPage(document, data, { mode, baseUrl, landmark }).html,
    },
  });
}

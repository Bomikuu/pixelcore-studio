import { normalizeGlobalFonts, walk } from './document.js';
import { validateBrandKit } from './theme.js';

export function templateBranding(template, current, { choice = 'keep', brandKit } = {}) {
  const result = structuredClone(template);
  if (!['keep', 'template', 'import'].includes(choice))
    throw new Error('Choose a valid branding option.');
  result.theme = structuredClone(current.theme);
  if (choice === 'template') {
    result.theme.colors = structuredClone(template.theme.colors);
    result.theme.name = template.theme.name;
  }
  if (choice === 'import') {
    const kit = validateBrandKit(brandKit);
    for (const key of ['headingFont', 'bodyFont', 'baseSize'])
      if (kit[key] !== undefined) result.theme[key] = kit[key];
    result.theme.colors = { ...result.theme.colors, ...kit.colors };
  }
  return result;
}
const nodeKeys = ['id', 'type', 'props', 'children', 'style', 'responsive'];
const pageKeys = [
  ...nodeKeys,
  'schemaVersion',
  'title',
  'mode',
  'theme',
  'context',
  'motionDisabled',
  'seo',
  'analytics',
];
const forbidden = new Set([
  '__proto__',
  'prototype',
  'constructor',
  'html',
  'javascript',
  'raw_html',
  'script',
  'css',
]);

export function templateDocument(value) {
  // Validate before cloning or traversing untrusted files, and never retain host context.
  const doc = normalizeGlobalFonts(value);
  function check(v, depth = 0) {
    if (depth > 25) throw new Error('Template settings are too deeply nested.');
    if (v && typeof v === 'object')
      for (const [key, item] of Object.entries(v)) {
        if (forbidden.has(key)) throw new Error('Executable template content is not allowed.');
        check(item, depth + 1);
      }
  }
  check(doc);
  walk(doc, (n) => {
    if (Object.keys(n).some((k) => !(n === doc ? pageKeys : nodeKeys).includes(k)))
      throw new Error('Unsupported template document field.');
  });
  if (
    Object.keys(doc.theme).some(
      (k) =>
        !['name', 'colors', 'headingFont', 'bodyFont', 'baseSize', 'scale', 'radius'].includes(k),
    )
  )
    throw new Error('Unsupported template theme field.');
  delete doc.context;
  delete doc.analytics;
  return doc;
}

export function createTemplate({ name, description = '', document }) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100)
    throw new Error('Give your template a name of 1–100 characters.');
  if (typeof description !== 'string' || description.length > 300)
    throw new Error('Keep the template description within 300 characters.');
  return {
    version: 1,
    name: name.trim(),
    description: description.trim(),
    document: templateDocument(document),
  };
}

export function parseTemplateJSON(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 550000)
    throw new Error('Choose a template JSON file smaller than 550 KB.');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      'This file is not valid JSON. Choose an exported website or template JSON file.',
    );
  }
  if (value?.type === 'page')
    return createTemplate({
      name: value.title?.slice(0, 100) || 'Imported template',
      document: value,
    });
  if (
    !value ||
    value.version !== 1 ||
    Object.keys(value).some((k) => !['version', 'name', 'description', 'document'].includes(k))
  )
    throw new Error(
      'Unsupported template format. Use a version 1 template or an exported website document.',
    );
  return createTemplate(value);
}

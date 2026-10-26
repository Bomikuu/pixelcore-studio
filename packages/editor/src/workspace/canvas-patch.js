/** Patch trusted renderer output while keeping stable page/media nodes alive. */
export function patchCanvas(document, html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const key = (node) =>
    node.nodeType === 1 ? node.getAttribute('data-wb-id') || node.id || null : null;
  const existing = new Map(
    [...document.body.querySelectorAll('[data-wb-id],[id]')].map((node) => [key(node), node]),
  );
  const used = new Set();
  const compatible = (a, b) =>
    a?.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName);
  function children(parent, incoming) {
    let cursor = parent.firstChild;
    for (const next of [...incoming.childNodes]) {
      const id = key(next);
      let current = id ? existing.get(id) : cursor;
      if (used.has(current) || !compatible(current, next) || (!id && key(current)))
        current = next.cloneNode(false);
      used.add(current);
      if (current !== cursor) parent.insertBefore(current, cursor);
      if (current.nodeType === 1) {
        for (const attr of [...current.attributes])
          if (!next.hasAttribute(attr.name) && !['open'].includes(attr.name))
            current.removeAttribute(attr.name);
        for (const attr of [...next.attributes])
          if (current.getAttribute(attr.name) !== attr.value)
            current.setAttribute(attr.name, attr.value);
        children(current, next);
      } else if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      cursor = current.nextSibling;
    }
    while (cursor) {
      const next = cursor.nextSibling;
      cursor.remove();
      cursor = next;
    }
  }
  children(document.body, template.content);
}

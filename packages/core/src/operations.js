import {
  validateDocument,
  findNode,
  findParent,
  cloneNode,
  containers,
  normalizeGlobalFonts,
} from './document.js';
import { stylePresets, presetStyleKeys } from './style-presets.js';
import { effectiveStyle } from './responsive.js';
export function applyOperation(source, operation) {
  const doc = normalizeGlobalFonts(source),
    inverse = { type: 'restore', document: structuredClone(source) };
  if (operation.type === 'restore') {
    validateDocument(operation.document);
    return { document: normalizeGlobalFonts(operation.document), inverse };
  }
  if (operation.type === 'theme') {
    doc.theme = {
      ...doc.theme,
      ...structuredClone(operation.value),
      colors: { ...doc.theme.colors, ...operation.value.colors },
    };
  } else if (operation.type === 'document') {
    for (const k of ['title', 'mode', 'motionDisabled', 'context', 'seo'])
      if (operation.value[k] !== undefined) doc[k] = operation.value[k];
  } else {
    const current = findNode(doc, operation.id);
    if (!current) throw new Error('Element not found.');
    const parent = findParent(doc, operation.id);
    let ancestor = parent;
    while (ancestor) {
      if (ancestor.type === 'global-section')
        throw new Error('Edit the shared source or detach this linked section.');
      ancestor = findParent(doc, ancestor.id);
    }
    if (
      current.type === 'global-section' &&
      !['remove', 'move', 'duplicate'].includes(operation.type)
    )
      throw new Error('Edit the shared source or detach this linked section.');
    switch (operation.type) {
      case 'text':
        if (current.props.text && typeof current.props.text === 'object' && !operation.detach)
          throw new Error('Connected text must be changed at its source or explicitly detached.');
        current.props.text = String(operation.value);
        break;
      case 'props':
        for (const [key, value] of Object.entries(operation.value))
          if (
            current.props[key] &&
            typeof current.props[key] === 'object' &&
            !Array.isArray(current.props[key]) &&
            typeof value !== 'object' &&
            !operation.detach
          )
            throw new Error('Connected values must be explicitly detached before editing.');
        current.props = { ...current.props, ...structuredClone(operation.value) };
        break;
      case 'style-preset': {
        const preset = stylePresets(current.type, doc.theme).find((p) => p.id === operation.preset);
        if (!preset) throw new Error('This style preset is unavailable for this element.');
        const bp = operation.breakpoint || 'desktop';
        if (!['desktop', 'tablet', 'phone'].includes(bp)) throw new Error('Invalid breakpoint.');
        const hidden = effectiveStyle(current, bp).display === 'none';
        const layer = bp === 'desktop' ? current.style : (current.responsive[bp] ||= {});
        for (const key of presetStyleKeys(current.type)) delete layer[key];
        Object.assign(layer, structuredClone(preset.style));
        if (hidden && Object.hasOwn(preset.style, 'display')) layer.display = 'none';
        break;
      }
      case 'style':
        if (Object.hasOwn(operation.value, 'fontFamily'))
          throw new Error('Font families are set globally in Theme & branding.');
        {
          const layer =
            operation.breakpoint && operation.breakpoint !== 'desktop'
              ? (current.responsive[operation.breakpoint] ||= {})
              : current.style;
          if (Object.hasOwn(operation.value, 'background')) delete layer.backgroundColor;
          if (Object.hasOwn(operation.value, 'backgroundColor')) delete layer.background;
          Object.assign(layer, structuredClone(operation.value));
        }
        break;
      case 'reset-style':
        if (operation.property) {
          const layer =
            operation.breakpoint && operation.breakpoint !== 'desktop'
              ? current.responsive[operation.breakpoint]
              : current.style;
          if (layer) delete layer[operation.property];
          break;
        }
        if (operation.breakpoint && operation.breakpoint !== 'desktop')
          current.responsive[operation.breakpoint] = {};
        else current.style = {};
        break;
      case 'insert':
        if (!containers.includes(current.type)) throw new Error('This element cannot be a parent.');
        current.children.splice(
          operation.index ?? current.children.length,
          0,
          structuredClone(operation.node),
        );
        break;
      case 'duplicate':
        if (!parent) throw new Error('Cannot duplicate the page.');
        parent.children.splice(parent.children.indexOf(current) + 1, 0, cloneNode(current));
        break;
      case 'remove':
        if (!parent) throw new Error('Cannot remove the page.');
        parent.children.splice(parent.children.indexOf(current), 1);
        break;
      case 'move': {
        const dest = findNode(doc, operation.parentId);
        if (!dest || !containers.includes(dest.type))
          throw new Error('Invalid destination parent.');
        let destination = dest;
        while (destination) {
          if (destination.type === 'global-section')
            throw new Error('Detach the linked section before moving elements into it.');
          destination = findParent(doc, destination.id);
        }
        if (!parent || findNode(current, dest.id))
          throw new Error('Cannot nest an element inside its descendant.');
        if (operation.beforeId === current.id) break;
        const before = operation.beforeId
          ? dest.children.find((n) => n.id === operation.beforeId)
          : null;
        if (operation.beforeId && !before) throw new Error('Destination sibling not found.');
        parent.children.splice(parent.children.indexOf(current), 1);
        const i = before ? dest.children.indexOf(before) : dest.children.length;
        dest.children.splice(i, 0, current);
        break;
      }
      default:
        throw new Error('Unsupported edit operation.');
    }
  }
  validateDocument(doc);
  return { document: normalizeGlobalFonts(doc), inverse };
}
export function createHistory(initial, onChange = () => {}, prepare = (document) => document) {
  let document = normalizeGlobalFonts(initial),
    undo = [],
    redo = [];
  return {
    get document() {
      return document;
    },
    get canUndo() {
      return undo.length > 0;
    },
    get canRedo() {
      return redo.length > 0;
    },
    apply(op) {
      const result = applyOperation(document, op);
      const prepared = prepare(result.document, op);
      validateDocument(prepared);
      undo.push(result.inverse);
      if (undo.length > 100) undo.shift();
      redo = [];
      document = prepared;
      onChange(document);
      return document;
    },
    undo() {
      if (!undo.length) return;
      const r = applyOperation(document, undo.pop());
      redo.push(r.inverse);
      document = r.document;
      onChange(document);
    },
    redo() {
      if (!redo.length) return;
      const r = applyOperation(document, redo.pop());
      undo.push(r.inverse);
      document = r.document;
      onChange(document);
    },
    replace(next) {
      document = normalizeGlobalFonts(next);
      undo = [];
      redo = [];
      onChange(document);
    },
  };
}

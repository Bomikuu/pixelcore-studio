export const breakpoints = ['desktop', 'tablet', 'phone'];
const paddingSides = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
export function effectiveStyle(node, breakpoint = 'desktop') {
  const result = {};
  for (const bp of breakpoints.slice(0, breakpoints.indexOf(breakpoint) + 1)) {
    const layer = bp === 'desktop' ? node.style || {} : node.responsive?.[bp] || {};
    if (Object.hasOwn(layer, 'padding')) for (const key of paddingSides) delete result[key];
    if (Object.hasOwn(layer, 'backgroundColor')) delete result.background;
    if (Object.hasOwn(layer, 'background')) delete result.backgroundColor;
    Object.assign(result, layer);
  }
  return result;
}
export function styleOrigin(node, property, breakpoint = 'desktop') {
  for (const bp of breakpoints.slice(0, breakpoints.indexOf(breakpoint) + 1).reverse()) {
    const layer = bp === 'desktop' ? node.style || {} : node.responsive?.[bp] || {};
    if (
      Object.hasOwn(layer, property) ||
      (paddingSides.includes(property) && Object.hasOwn(layer, 'padding'))
    )
      return bp;
  }
  return 'default';
}
export function headingSize(theme, level = 2) {
  const { baseSize: b, scale: s } = theme;
  return { 1: b * s ** 4, 2: b * s ** 3, 3: b * s ** 2, 4: b * s, 5: b, 6: b * 0.875 }[level] || b;
}

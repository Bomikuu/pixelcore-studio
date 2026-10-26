export const tokens = {
  primary: '#3D5AFE',
  primaryHover: '#536DFE',
  onPrimary: '#FFFFFF',
  background: '#101112',
  surface: '#18191B',
  input: '#141517',
  text: '#F1F2F3',
  muted: '#A0A3AA',
  border: '#33363B',
  controlBorder: '#626873',
  overlay: '#000000',
  danger: '#FF9F9F',
  warning: '#E3C78C',
  focus: '#8DA6FF',
  selected: '#292C31',
  selection: '#3B4880',
  canvas: '#FFFFFF',
  tooltipBackground: '#F1F2F3',
  tooltipText: '#1D2433',
  colorScheme: 'dark',
  radius: '5px',
  font: 'Manrope, system-ui, sans-serif',
};
export const lightTokens = {
  ...tokens,
  primaryHover: '#2947DB',
  background: '#F3F5F8',
  surface: '#FFFFFF',
  input: '#FFFFFF',
  text: '#1D2433',
  muted: '#566176',
  border: '#D9DEE8',
  controlBorder: '#7C879A',
  danger: '#B42335',
  warning: '#795400',
  focus: '#2448D8',
  selected: '#E9EDFA',
  selection: '#D6DFFF',
  tooltipBackground: '#1D2433',
  tooltipText: '#FFFFFF',
  colorScheme: 'light',
};
export const themeTokens = (appearance = 'dark') => (appearance === 'light' ? lightTokens : tokens);
export const tokenCss = (appearance = 'dark') =>
  Object.entries(themeTokens(appearance))
    .map(([k, v]) => `--editor-${k}:${v}`)
    .join(';');

export function applyTokens(element, appearance = 'dark') {
  const previous = new Map();
  for (const [k, v] of Object.entries(themeTokens(appearance))) {
    const key = `--editor-${k}`;
    previous.set(key, element.style.getPropertyValue(key));
    element.style.setProperty(key, v);
  }
  return () => {
    for (const [key, value] of previous)
      value ? element.style.setProperty(key, value) : element.style.removeProperty(key);
  };
}

const paths = {
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  'eye-off': [
    'm3 3 18 18',
    'M9.8 5.2A12 12 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.4 4.3M6.2 6.2A18 18 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.8-1.8',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
  ],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  sun: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  ],
  moon: ['M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z'],
  save: ['M4 3h13l4 4v14H3V3z', 'M7 3v6h10V3M7 21v-8h10v8'],
  share: ['M12 16V3m-4 4 4-4 4 4', 'M5 12H3v9h18v-9h-2'],
  publish: ['M12 16V3m-4 4 4-4 4 4', 'M4 15v6h16v-6'],
  download: ['M12 3v13m-4-4 4 4 4-4', 'M4 17v4h16v-4'],
  upload: ['M12 16V3m-4 4 4-4 4 4', 'M4 17v4h16v-4'],
  copy: ['M9 9h12v12H9z', 'M15 9V3H3v12h6'],
  remove: ['M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7'],
  up: ['M12 20V4m-6 6 6-6 6 6'],
  down: ['M12 4v16m-6-6 6 6 6-6'],
  edit: ['m15 4 5 5L8 21H3v-5z', 'm12 7 5 5'],
  data: ['M3 6c0-4 18-4 18 0s-18 4-18 0', 'M3 6v12c0 4 18 4 18 0V6', 'M3 12c0 4 18 4 18 0'],
  shared: ['M9 8H6a4 4 0 0 0 0 8h3', 'M15 8h3a4 4 0 0 1 0 8h-3', 'M8 12h8'],
  history: ['M3 11a9 9 0 1 1 2 7', 'M3 4v7h7', 'M12 7v5l3 2'],
  pages: ['M4 3h10l4 4v14H4z', 'M14 3v5h5', 'M8 12h6M8 16h6'],
  layers: ['m12 3 9 5-9 5-9-5z', 'm3 12 9 5 9-5', 'm3 16 9 5 9-5'],
  add: ['M12 5v14M5 12h14'],
  templates: ['M3 3h18v18H3z', 'M3 9h18M9 9v12'],
  media: ['M3 3h18v18H3z', 'm3 17 6-6 4 4 3-3 5 5', 'M8 7h.01'],
  theme: [
    'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h3a6 6 0 0 0 0-10z',
    'M7 9h.01M10 6h.01M16 7h.01M6 14h.01',
  ],
  settings: ['M4 7h16M4 17h16M8 4v6M16 14v6'],
  desktop: ['M3 4h18v13H3z', 'M8 21h8M12 17v4'],
  tablet: ['M5 2h14v20H5z', 'M11 18h2'],
  phone: ['M7 2h10v20H7z', 'M11 18h2'],
  undo: ['M9 5 4 10l5 5', 'M4 10h10a6 6 0 0 1 0 12'],
  redo: ['m15 5 5 5-5 5', 'M20 10H10a6 6 0 0 0 0 12'],
  preview: ['m8 5 11 7-11 7z'],
  close: ['m6 6 12 12M6 18 18 6'],
  chevron: ['m9 5 7 7-7 7'],
  search: ['M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14', 'm15 15 6 6'],
  back: ['m10 5-7 7 7 7M3 12h18'],
  'arrow-right': ['M3 12h18m-7-7 7 7-7 7'],
  refresh: ['M20 7a9 9 0 1 0 1 8', 'M20 2v6h-6'],
  check: ['m5 12 4 4L19 6'],
  more: ['M5 12h.01M12 12h.01M19 12h.01'],
  zoomIn: ['M5 12h14M12 5v14'],
  zoomOut: ['M5 12h14'],
};
export function icon(d, name) {
  const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries({
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.6,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }))
    svg.setAttribute(k, v);
  for (const value of paths[name] || paths.pages) {
    const path = d.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', value);
    svg.append(path);
  }
  return svg;
}

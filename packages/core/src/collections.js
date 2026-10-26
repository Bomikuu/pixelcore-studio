import { resolveValue } from './document.js';
export function collectionRows(data, props) {
  let rows = data;
  for (const key of props.source.split('.')) {
    if (
      ['__proto__', 'constructor', 'prototype', 'guest', 'patient', 'encounter'].includes(key) ||
      !rows ||
      typeof rows !== 'object' ||
      !Object.hasOwn(rows, key)
    )
      return { rows: [], status: 'unavailable', total: 0 };
    rows = rows[key];
  }
  const state = data.collectionStates?.[props.source];
  if (state?.status === 'error' || state?.status === 'loading')
    return { rows: [], status: state.status, total: 0 };
  if (!Array.isArray(rows)) return { rows: [], status: 'unavailable', total: 0 };
  rows = rows
    .slice(0, 10000)
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  const value = (row, path) => resolveValue({ source: 'item', path }, { item: row });
  if (props.filterField && props.filterValue !== undefined && props.filterValue !== '')
    rows = rows.filter(
      (row) =>
        String(value(row, props.filterField) ?? '').toLocaleLowerCase() ===
        props.filterValue.toLocaleLowerCase(),
    );
  if (props.sortField)
    rows = [...rows].sort((a, b) => {
      const x = value(a, props.sortField),
        y = value(b, props.sortField);
      const diff =
        x == null
          ? y == null
            ? 0
            : 1
          : y == null
            ? -1
            : Number.isFinite(Number(x)) && Number.isFinite(Number(y))
              ? Number(x) - Number(y)
              : String(x).localeCompare(String(y), data.locale || 'en', { numeric: true });
      return diff * (props.sortDirection === 'desc' ? -1 : 1);
    });
  return {
    rows: rows.slice(props.offset || 0, (props.offset || 0) + (props.limit || 6)),
    status: 'ready',
    total: rows.length,
  };
}
export function formatValue(binding, data) {
  const value = resolveValue(binding, data);
  if (!binding || typeof binding !== 'object' || value == null) return value;
  try {
    if (binding.format === 'currency')
      return Number.isFinite(Number(value))
        ? new Intl.NumberFormat(data.locale || 'en-PH', {
            style: 'currency',
            currency: data.currency || 'PHP',
          }).format(Number(value))
        : '';
    if (binding.format === 'date')
      return Number.isNaN(Date.parse(String(value)))
        ? ''
        : new Intl.DateTimeFormat(data.locale || 'en-PH', {
            dateStyle: 'long',
            timeZone: data.timeZone || 'UTC',
          }).format(new Date(value));
  } catch {
    return String(value);
  }
  return value;
}

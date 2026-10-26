export function validateComponentProps(type, props) {
  if (type !== 'component') return;
  if (
    typeof props.componentId !== 'string' ||
    !/^[a-f\d-]{36}$/i.test(props.componentId) ||
    !Number.isInteger(props.componentVersion) ||
    props.componentVersion < 1 ||
    props.componentVersion > 100
  )
    throw new Error('Invalid component catalog reference.');
  let values;
  try {
    values = JSON.parse(props.componentSettings || '{}');
  } catch {
    throw new Error('Invalid component settings.');
  }
  if (
    !values ||
    Array.isArray(values) ||
    typeof values !== 'object' ||
    Object.keys(values).length > 20 ||
    Object.entries(values).some(
      ([k, v]) =>
        !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k) ||
        ['constructor', 'prototype', '__proto__'].includes(k.toLowerCase()) ||
        !(
          (typeof v === 'string' && v.length <= 2000) ||
          (typeof v === 'number' && Number.isFinite(v))
        ),
    )
  )
    throw new Error('Component settings must contain only declared text, colors and numbers.');
}

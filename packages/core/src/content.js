export function validateContentProps(type, props) {
  if (props.items !== undefined) {
    if (
      !['accordion', 'tabs'].includes(type) ||
      !Array.isArray(props.items) ||
      props.items.length < 1 ||
      props.items.length > 20 ||
      props.items.some(
        (item) =>
          !item ||
          typeof item !== 'object' ||
          Array.isArray(item) ||
          Object.keys(item).some((k) => !['title', 'body'].includes(k)) ||
          typeof item.title !== 'string' ||
          !item.title.trim() ||
          item.title.length > 160 ||
          typeof item.body !== 'string' ||
          item.body.length > 12000,
      )
    )
      throw new Error('Use 1–20 items with a title and plain text content.');
  }
  if (['accordion', 'tabs'].includes(type) && !props.items)
    throw new Error('Add at least one content item.');
  for (const [key, values] of Object.entries({
    fit: ['cover', 'contain'],
    aspect: ['auto', '1/1', '4/3', '3/4', '16/9', '4/5', '3/2'],
    decorative: [0, 1],
  }))
    if (props[key] !== undefined && !values.includes(props[key]))
      throw new Error(`Invalid ${key}.`);
  for (const key of ['focalX', 'focalY'])
    if (
      props[key] !== undefined &&
      (typeof props[key] !== 'number' ||
        !Number.isFinite(props[key]) ||
        props[key] < 0 ||
        props[key] > 100)
    )
      throw new Error('Focal point must be between 0 and 100.');
}

import { el, button, field } from '../components/ui/index.js';
export function renderContentControls({ d, panel, command }, n) {
  const update = (value) => command({ type: 'props', id: n.id, value });
  if (['accordion', 'tabs'].includes(n.type)) {
    const items = n.props.items;
    items.forEach((item, i) => {
      const edit = (key, value) =>
        update({ items: items.map((v, j) => (i === j ? { ...v, [key]: value } : v)) });
      panel.append(
        el(d, 'h3', { text: `Item ${i + 1}` }),
        field(d, 'Title', item.title, (v) => edit('title', v)),
        field(d, 'Content', item.body, (v) => edit('body', v), { type: 'textarea' }),
      );
      panel.append(
        button(d, 'Remove item', () => update({ items: items.filter((_, j) => j !== i) }), {
          disabled: items.length === 1,
        }),
      );
      if (i > 0)
        panel.append(
          button(d, 'Move item up', () => {
            const next = structuredClone(items);
            [next[i - 1], next[i]] = [next[i], next[i - 1]];
            update({ items: next });
          }),
        );
    });
    panel.append(
      button(
        d,
        'Add item',
        () => update({ items: [...items, { title: 'New item', body: 'Add your content.' }] }),
        { disabled: items.length >= 20 },
      ),
    );
  }
  if (n.type === 'image') {
    panel.append(
      field(d, 'Image fit', n.props.fit || 'cover', (v) => update({ fit: v }), {
        options: ['cover', 'contain'],
      }),
      field(d, 'Crop ratio', n.props.aspect || 'auto', (v) => update({ aspect: v }), {
        options: ['auto', '1/1', '4/3', '3/4', '16/9', '4/5', '3/2'],
      }),
      field(d, 'Focal point: horizontal (%)', n.props.focalX ?? 50, (v) => update({ focalX: v }), {
        type: 'number',
        min: 0,
        max: 100,
      }),
      field(d, 'Focal point: vertical (%)', n.props.focalY ?? 50, (v) => update({ focalY: v }), {
        type: 'number',
        min: 0,
        max: 100,
      }),
      field(
        d,
        'Image purpose',
        n.props.decorative ? 'decorative' : 'content',
        (v) => update({ decorative: v === 'decorative' ? 1 : 0 }),
        { options: ['content', 'decorative'] },
      ),
    );
  }
}

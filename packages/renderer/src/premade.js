import { createDocument, node, schemes, safeUrl } from '@sitebuilder/core';

const heading = (text, level = 2) =>
  node('heading', {
    text,
    level,
    ...(level === 1 && typeof text === 'object'
      ? { fallbackText: text.source === 'event' ? 'You’re invited.' : 'Welcome.' }
      : {}),
  });
const text = (value) => node('text', { text: value });
const action = (label, href) => node('button', { text: label, href });
const group = (children, style = {}) => ({
  ...node('container', {}, children),
  style: { padding: 0, ...style },
});
const columns = (children) => ({
  ...node('columns', {}, children),
  style: { display: 'grid', gridColumns: children.length, gap: 48, alignItems: 'center' },
  responsive: { tablet: { gap: 32 }, phone: { gridColumns: 1, gap: 24 } },
});
const section = (name, children, tinted = false, centered = false) => ({
  ...node('section', { name }, children),
  style: {
    padding: 80,
    ...(tinted ? { backgroundColor: 'surface' } : {}),
    ...(centered
      ? { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }
      : {}),
  },
  responsive: { tablet: { padding: 48 }, phone: { padding: 28 } },
});
const widget = (kind, variant = 'inline') =>
  node('widget', { widgetId: `pixelcore.event-${kind}`, source: 'event', variant });
const photo = (assetId, data, aspect = '4/5') =>
  node('image', {
    assetId,
    alt: data.assets?.[assetId]?.alt || '',
    aspect,
    fit: 'cover',
  });
const questions = (items) => node('accordion', { items });

/** Live layouts retain bindings; fixed layouts start with approved, editable identity copy. */
export function createPremade(id, name, category, data = {}) {
  const wedding = category === 'Wedding',
    shop = category === 'Storefront',
    live = wedding || shop,
    doc = createDocument({ title: name, mode: live ? 'live' : 'fixed' });
  const palette = schemes.find(
    (s) =>
      s.id ===
      (id === 'wedding-garden' ? 'forest' : id === 'storefront-compact' ? 'ocean' : 'clean'),
  );
  doc.theme = {
    ...doc.theme,
    name: id === 'wedding-editorial' ? 'Wedding editorial' : palette.name,
    colors: { ...palette.colors },
    headingFont: wedding ? 'Cormorant Garamond' : 'Manrope',
    bodyFont: 'Manrope',
    scale: wedding ? 1.4 : 1.3,
    radius: wedding ? 4 : 8,
  };
  if (id === 'wedding-editorial')
    doc.theme.colors = {
      background: '#fbf9f4',
      surface: '#f1ede3',
      text: '#303c31',
      muted: '#5f685b',
      primary: '#445c43',
      onPrimary: '#ffffff',
      accent: '#795a3c',
      border: '#c8cdbf',
    };
  const images = Object.entries(data.assets || {})
    .filter(
      ([key, asset]) =>
        key !== 'brand-logo' && asset?.type !== 'video' && safeUrl(asset?.url, { asset: true }),
    )
    .map(([key]) => key);
  const hero = images.includes('hero') ? 'hero' : images[0] || '',
    secondary = images.find((key) => key !== hero) || hero;
  const identity = (path, fallback) =>
    live ? { source: 'identity', path } : String(data.identity?.[path] || fallback);
  const contact = () =>
    section(
      'Contact',
      [
        columns([
          group([
            heading(wedding ? 'A question before the day?' : 'Let’s talk.'),
            text(
              wedding
                ? 'Reach out to the hosts if you need a hand with your invitation or travel plans.'
                : 'Find our contact details and social links below. We look forward to hearing from you.',
            ),
          ]),
          group([
            text(identity('address', '')),
            text(identity('email', '')),
            text(identity('phone', '')),
          ]),
        ]),
      ],
      true,
    );
  let content;
  if (shop) {
    const compact = id === 'storefront-compact';
    content = [
      section(
        'Welcome',
        [
          columns([
            group([
              heading(identity('name', 'Your collection'), 1),
              text(identity('description', 'Explore the collection.')),
              action('Shop the collection', '#collection'),
            ]),
            group([photo(hero, data)]),
          ]),
        ],
        true,
      ),
      section('Collection', [
        heading(compact ? 'Find your next favorite.' : 'The collection.'),
        text('Explore what’s available now.'),
        node('products', { source: 'products', limit: compact ? 3 : 6 }),
      ]),
      section(
        'Our story',
        [
          columns([
            group([photo(secondary, data, '1/1')]),
            group([
              heading('Get to know us.'),
              text(identity('description', 'Discover our story.')),
              action('Get in touch', '#contact'),
            ]),
          ]),
        ],
        true,
      ),
      section('Shopping guide', [
        heading('Before you choose.'),
        questions([
          {
            title: 'Where can I find product details?',
            body: 'Open a product to see its current details, price and availability.',
          },
          {
            title: 'How do I ask about an item?',
            body: 'Use the contact details below and include the name of the product you’re interested in.',
          },
          {
            title: 'Where can I find delivery and returns information?',
            body: 'Check the store’s published policies or contact the team before placing your order.',
          },
        ]),
      ]),
      ...(!compact
        ? [
            section(
              'Explore more',
              [
                heading('Something catch your eye?'),
                text('Take another look at the collection, or reach out with a question.'),
                action('Browse the collection', '#collection'),
              ],
              true,
              true,
            ),
          ]
        : []),
      contact(),
    ];
  } else if (wedding) {
    const garden = id === 'wedding-garden';
    content = [
      section(
        'The invitation',
        [
          heading({ source: 'event', path: 'title' }, 1),
          text('Together with the people we love.'),
          text({ source: 'event', path: 'date' }),
          text({ source: 'event', path: 'venue' }),
          action('Reply to your invitation', '#rsvp'),
          photo(hero, data, '16/9'),
        ],
        true,
        true,
      ),
      section('Our story', [heading('A story worth celebrating.'), widget('story')]),
      ...(!garden
        ? [
            section(
              'The people',
              [heading('At the heart of it all.'), widget('people')],
              true,
              true,
            ),
          ]
        : []),
      section('The countdown', [heading('See you soon.'), widget('countdown')], false, true),
      section(
        'The programme',
        [
          heading('How the day unfolds.'),
          node('event-schedule', { source: 'schedule', limit: 20 }),
        ],
        true,
      ),
      section('The venue', [
        columns([
          group([photo(secondary, data, '1/1')]),
          group([
            heading('A place to come together.'),
            text({ source: 'event', path: 'venue' }),
            widget('venue'),
          ]),
        ]),
      ]),
      section(
        'Guest information',
        [
          heading('Before the celebration.'),
          widget('notes'),
          questions([
            {
              title: 'How do I send my RSVP?',
              body: 'Open your personal invitation link to send your response. If you need help, contact the hosts.',
            },
            {
              title: 'Can I bring another guest?',
              body: 'Your personal invitation shows who is invited and the number of places available. Please check with the hosts before making arrangements.',
            },
            {
              title: 'Where can I find arrival and dress-code details?',
              body: 'Check the programme and guest information on this page. Contact the hosts if you need more details.',
            },
          ]),
        ],
        true,
      ),
      section('RSVP', [widget('rsvp', garden ? 'split' : 'inline')]),
      section('Gift information', [heading('A note on gifts.'), widget('gifts')], true, true),
      contact(),
    ];
  } else {
    const imageLed = id === 'landing-image-led';
    const opening = section(
      'Welcome',
      [
        heading(identity('name', 'Make room for your next idea.'), 1),
        text(
          identity(
            'description',
            'A place to discover our work, get to know us and start a conversation.',
          ),
        ),
        action('Explore our story', '#about'),
      ],
      true,
    );
    if (imageLed && hero)
      opening.style = {
        ...opening.style,
        minHeight: 560,
        color: '#ffffff',
        background: {
          type: 'image',
          assetId: hero,
          overlay: '#000000',
          opacity: 0.65,
          fit: 'cover',
          focal: '50% 50%',
        },
      };
    else opening.children = [columns([group(opening.children), group([photo(hero, data)])])];
    content = [
      opening,
      section('About', [
        columns([
          group([photo(secondary, data, '1/1')]),
          group([
            heading('A closer look at who we are.'),
            text(
              identity(
                'description',
                'Every project starts with a conversation. Explore our work and get in touch to learn more.',
              ),
            ),
            action('Start a conversation', '#contact'),
          ]),
        ]),
      ]),
      section(
        'Our approach',
        [
          heading('From a first idea to what’s next.'),
          columns([
            group([
              heading('Start a conversation', 3),
              text('Tell us what you have in mind and what matters to you.'),
            ]),
            group([
              heading('Explore the possibilities', 3),
              text('Take a closer look at our work and bring your questions.'),
            ]),
            group([
              heading('Find your next step', 3),
              text('Get in touch to discuss the details and decide where to go next.'),
            ]),
          ]),
        ],
        true,
      ),
      section('Gallery', [
        heading(imageLed ? 'Let the work speak.' : 'See a little more.'),
        node('gallery', { assetIds: images.slice(0, 6) }),
      ]),
      section(
        'Questions',
        [
          heading('Good to know.'),
          questions([
            {
              title: 'How do we get started?',
              body: 'Reach out through the contact details below. Share what you’re looking for so we can continue the conversation.',
            },
            {
              title: 'Where can I see more?',
              body: 'Explore the gallery and follow our official social profiles in the footer for more from us.',
            },
          ]),
        ],
        true,
      ),
      section(
        'Let’s connect',
        [
          heading('Have something in mind?'),
          text('We’d love to hear about it.'),
          action('Find our contact details', '#contact'),
        ],
        false,
        true,
      ),
      contact(),
    ];
  }
  doc.children = [
    node('header', {
      name: 'Header',
      variant: wedding ? 'monogram' : id === 'landing-minimal' ? 'center' : 'left',
      ...(wedding ? { source: 'event' } : {}),
    }),
    ...content,
    node('footer', {
      name: 'Footer',
      variant: wedding ? 'wedding' : 'columns',
      ...(wedding ? { source: 'event' } : {}),
    }),
  ];
  return doc;
}

import { createPremade } from './premade.js';
import { node, cloneNode } from '@sitebuilder/core';
const h = (text, level = 2) => node('heading', { text, level });
const p = (text) => node('text', { text });
const link = (text, href = '#contact') => node('button', { text, href });
const image = (assetId = 'hero', alt = '') => node('image', { assetId, alt });
const group = (children, style = {}) => ({
  ...node('container', {}, children),
  style: { padding: 0, ...style },
});
const section = (name, children, style = {}) => ({
  ...node('section', { name }, children),
  style: { padding: 72, ...style },
  responsive: { phone: { padding: 28 } },
});
const columns = (children) => ({
  ...node('columns', {}, children),
  style: { display: 'grid', gridColumns: children.length, gap: 40, alignItems: 'center' },
});
const assets = (data) =>
  Object.entries(data?.assets || {})
    .filter(([, a]) => a.type !== 'video')
    .map(([id]) => id);
const preset = (id, name, category, description, create, requires = []) => ({
  id,
  name,
  category,
  description,
  create,
  requires,
});
const event = (kind, variant = 'inline') =>
  node('widget', { widgetId: `pixelcore.${kind}`, variant, source: 'event' });
export const sectionPresets = [
  preset(
    'header-left',
    'Logo + navigation',
    'Header & footer',
    'A clear brand mark, navigation and room to explore.',
    () => node('header', { variant: 'left', name: 'Header' }),
  ),
  preset(
    'header-center',
    'Centered identity',
    'Header & footer',
    'A centered wordmark with a quiet navigation line.',
    () => node('header', { variant: 'center', name: 'Header' }),
  ),
  preset(
    'header-monogram',
    'Wedding monogram',
    'Header & footer',
    'A minimal invitation header, centered on the occasion.',
    () => node('header', { variant: 'monogram', source: 'event', name: 'Wedding header' }),
  ),
  preset(
    'footer-compact',
    'Simple sign-off',
    'Header & footer',
    'Contact details and essential links in a compact close.',
    () => node('footer', { variant: 'compact', name: 'Footer' }),
  ),
  preset(
    'footer-columns',
    'Information footer',
    'Header & footer',
    'A generous close with navigation, contact and policy links.',
    () => node('footer', { variant: 'columns', name: 'Footer' }),
  ),
  preset(
    'footer-wedding',
    'With love',
    'Header & footer',
    'A considered final note for your invitation.',
    () => node('footer', { variant: 'wedding', source: 'event', name: 'Wedding footer' }),
  ),
  preset(
    'hero-split',
    'Editorial opening',
    'Hero',
    'A strong headline and image, balanced side by side.',
    () =>
      section(
        'Editorial opening',
        [
          columns([
            group([
              h('A little more\nconsidered.', 1),
              p('Thoughtful essentials, made for the way you live.'),
              link('Explore the collection', '#collection'),
            ]),
            group([image('hero', 'The collection')]),
          ]),
        ],
        { backgroundColor: 'surface', minHeight: 480 },
      ),
  ),
  preset(
    'hero-full',
    'Image-led opening',
    'Hero',
    'A photographic opening with a readable overlay.',
    () =>
      section(
        'Image-led opening',
        [
          h('Make room for\nsomething good.', 1),
          p('A new perspective. A place to begin.'),
          link('Discover more'),
        ],
        {
          background: {
            type: 'image',
            assetId: 'hero',
            overlay: '#000000',
            opacity: 0.5,
            fit: 'cover',
            focal: '50% 50%',
          },
          color: '#ffffff',
          minHeight: 600,
        },
      ),
  ),
  preset(
    'hero-invite',
    'The invitation',
    'Hero',
    'The occasion, its date, and a beautiful opening photograph.',
    () =>
      section(
        'The invitation',
        [
          h({ source: 'event', path: 'title' }, 1),
          p({ source: 'event', path: 'date' }),
          p({ source: 'event', path: 'venue' }),
          image('hero', 'The occasion'),
        ],
        { textAlign: 'center', backgroundColor: 'surface' },
      ),
    ['event'],
  ),
  preset(
    'hero-title',
    'A simple introduction',
    'Hero',
    'A generous title and concise introduction.',
    () =>
      section('Introduction', [
        h({ source: 'identity', path: 'name' }, 1),
        p({ source: 'identity', path: 'description' }),
        link('Get in touch', '#contact'),
      ]),
  ),
  preset(
    'story-split',
    'Image and story',
    'Content',
    'A photograph beside your story, with room for detail.',
    () =>
      section('Our story', [
        columns([
          group([image()]),
          group([
            h('Made with intention.'),
            p(
              'Use this space to share what matters to you. Add the details that make your story your own.',
            ),
            link('Our approach', '#contact'),
          ]),
        ]),
      ]),
  ),
  preset(
    'story-reverse',
    'Story and image',
    'Content',
    'Lead with your story, followed by a full-height image.',
    () =>
      section(
        'The approach',
        [
          columns([
            group([
              h('Good things take care.'),
              p('Share the people, process and ideas behind what you do.'),
            ]),
            group([image()]),
          ]),
        ],
        { backgroundColor: 'surface' },
      ),
  ),
  preset(
    'features',
    'Three reasons',
    'Content',
    'A clean three-column feature section that stacks on mobile.',
    () =>
      section('What matters', [
        h('Considered in every detail.'),
        columns(
          ['The materials', 'The process', 'The people'].map((title) =>
            group([
              h(title, 3),
              p('Add a specific, truthful detail about what makes your work special.'),
            ]),
          ),
        ),
      ]),
  ),
  preset(
    'quote',
    'A meaningful quote',
    'Content',
    'A generous quotation with a clear attribution.',
    () =>
      section(
        'A few words',
        [h('Add a meaningful quote here.'), p('Add the speaker’s name with their permission.')],
        { textAlign: 'center', backgroundColor: 'surface' },
      ),
  ),
  preset(
    'gallery-grid',
    'Photo collection',
    'Media',
    'A responsive collection with actual approved photographs.',
    (data) =>
      section('Gallery', [
        h('A closer look.'),
        node('gallery', { assetIds: assets(data).slice(0, 6) }),
      ]),
  ),
  preset(
    'image-caption',
    'Photograph + caption',
    'Media',
    'A single photograph with its own breathing room.',
    (data) =>
      section('Photograph', [
        {
          ...image(assets(data)[0] || 'hero'),
          props: {
            assetId: assets(data)[0] || 'hero',
            alt: 'Describe this photograph',
            caption: 'Add a short caption.',
          },
        },
      ]),
  ),
  preset(
    'image-pair',
    'Two photographs',
    'Media',
    'A paired image story with a natural mobile order.',
    (data) =>
      section('In pictures', [
        columns([
          group([image(assets(data)[0] || 'hero')]),
          group([image(assets(data)[1] || 'hero')]),
        ]),
      ]),
  ),
  preset(
    'video-poster',
    'Moving image',
    'Media',
    'A muted background video with a poster and readable content.',
    (data) =>
      section(
        'A moving story',
        [
          h('See the story unfold.'),
          p('Choose an approved video and poster in Background settings.'),
        ],
        {
          minHeight: 480,
          background: {
            type: 'video',
            assetId:
              Object.entries(data?.assets || {}).find(([, a]) => a.type === 'video')?.[0] || '',
            posterId: assets(data)[0] || 'hero',
          },
        },
      ),
  ),
  preset(
    'collection',
    'The collection',
    'Commerce',
    'Current products, with real images, prices and destinations.',
    () =>
      section('The collection', [
        h('Find your everyday.'),
        node('products', { source: 'products', limit: 6 }),
      ]),
    ['products'],
  ),
  preset(
    'collection-featured',
    'Featured selection',
    'Commerce',
    'A compact curated collection inside an editorial section.',
    () =>
      section(
        'Selected for you',
        [
          h('A few favorites.'),
          p('Discover the details in our current collection.'),
          node('products', { source: 'products', limit: 3 }),
        ],
        { backgroundColor: 'surface' },
      ),
    ['products'],
  ),
  preset(
    'services',
    'Ways we can help',
    'Commerce',
    'Public services with their actual descriptions.',
    () =>
      section('Our services', [
        h('A little help, thoughtfully delivered.'),
        node('services', { source: 'services', limit: 6 }),
      ]),
    ['services'],
  ),
  preset(
    'event-couple',
    'The people',
    'Wedding & event',
    'Introduce the people at the center of the occasion.',
    () =>
      section('The people', [h({ source: 'event', path: 'title' }), event('event-people')], {
        textAlign: 'center',
      }),
    ['event'],
  ),
  preset(
    'event-story',
    'Our story',
    'Wedding & event',
    'A timeline connected to the event’s existing story.',
    () => section('Our story', [h('How we got here.'), event('event-story')]),
    ['event'],
  ),
  preset(
    'event-countdown',
    'Counting the days',
    'Wedding & event',
    'A date-aware countdown in the event’s own timezone.',
    () =>
      section('The countdown', [h('We can’t wait to see you.'), event('event-countdown')], {
        textAlign: 'center',
        backgroundColor: 'surface',
      }),
    ['event'],
  ),
  preset(
    'programme',
    'The programme',
    'Wedding & event',
    'A timeline connected to the actual event schedule.',
    () =>
      section('The programme', [
        h('A day to remember.'),
        node('event-schedule', { source: 'schedule', limit: 20 }),
      ]),
    ['event'],
  ),
  preset(
    'event-venue',
    'The venue',
    'Wedding & event',
    'Venue details and a clear directions link.',
    () =>
      section('Find us here', [
        h('The setting.'),
        p({ source: 'event', path: 'venue' }),
        event('event-venue'),
      ]),
    ['event'],
  ),
  preset(
    'event-notes',
    'Guest information',
    'Wedding & event',
    'Dress code, travel and practical information.',
    () => section('Good to know', [h('A few details for the day.'), event('event-notes')]),
    ['event'],
  ),
  preset(
    'event-gifts',
    'A thoughtful gesture',
    'Wedding & event',
    'The event’s approved gift information.',
    () =>
      section(
        'Gift information',
        [
          h('Your presence is the gift.'),
          p('Add the gift information you would like to share with your guests.'),
        ],
        {
          textAlign: 'center',
        },
      ),
    ['event'],
  ),
  preset(
    'rsvp-inline',
    'RSVP card',
    'RSVP',
    'A focused response form, connected to private invitations.',
    () => section('RSVP', [event('event-rsvp', 'inline')]),
    ['rsvp'],
  ),
  preset(
    'rsvp-split',
    'An invitation to reply',
    'RSVP',
    'A photograph and response form, arranged side by side.',
    () => section('Your reply', [event('event-rsvp', 'split')]),
    ['rsvp'],
  ),
  preset(
    'rsvp-cta',
    'RSVP invitation',
    'RSVP',
    'A compact invitation to respond using a private guest link.',
    () => section('Join us', [event('event-rsvp', 'cta')], { textAlign: 'center' }),
    ['rsvp'],
  ),
  preset(
    'event-wishes',
    'Words from your guests',
    'Wedding & event',
    'A guest book of messages approved by the organizer.',
    () => section('With love', [h('Words we’ll keep.'), event('event-wishes')]),
    ['wishes'],
  ),
  preset(
    'faq',
    'Questions, answered',
    'Content',
    'A simple, readable question-and-answer layout.',
    () =>
      section('Questions, answered', [
        h('A few things to know.'),
        h('Add your first question', 3),
        p('Give a clear, helpful answer.'),
        h('Add another question', 3),
        p('Make the details easy to find.'),
      ]),
  ),
  preset(
    'contact',
    'Stay in touch',
    'Contact',
    'Real contact information with room for your invitation.',
    () =>
      section(
        'Contact',
        [
          h('Let’s start a conversation.'),
          p({ source: 'identity', path: 'address' }),
          p({ source: 'identity', path: 'phone' }),
          p({ source: 'identity', path: 'email' }),
        ],
        { backgroundColor: 'surface' },
      ),
  ),
  preset(
    'cta',
    'One clear next step',
    'Contact',
    'A concise close with one useful call to action.',
    () =>
      section(
        'Your next step',
        [h('Find something you’ll love.'), link('Get in touch', '#contact')],
        { textAlign: 'center' },
      ),
  ),
  preset(
    'social',
    'Find us elsewhere',
    'Contact',
    'Approved public social and information links.',
    () =>
      section('Around the web', [
        h('Stay connected.'),
        node('widget', {
          widgetId: 'pixelcore.social-links',
          source: 'identity',
          variant: 'inline',
        }),
      ]),
  ),
];
sectionPresets.push(
  preset(
    'wedding-travel',
    'Travel & accommodation',
    'Wedding',
    'A practical guide to arriving and staying nearby.',
    () =>
      section('Travel', [
        h('Make yourself at home.'),
        columns([
          group([
            h('Getting here', 3),
            p('Add your approved venue directions and transport details.'),
          ]),
          group([h('Stay nearby', 3), p('Add accommodation options and booking information.')]),
        ]),
      ]),
    ['event'],
  ),
  preset(
    'wedding-faq',
    'Guest questions',
    'Wedding',
    'Accessible answers for wedding guests.',
    () =>
      section('Guest questions', [
        h('Before the celebration.'),
        node('accordion', {
          items: [
            {
              title: 'When should we arrive?',
              body: 'Add the arrival time from your event schedule.',
            },
            { title: 'What should we wear?', body: 'Add your dress code and practical details.' },
            {
              title: 'How do we RSVP?',
              body: 'Use your personal invitation link. Contact the hosts if you need help.',
            },
          ],
        }),
      ]),
    ['event'],
  ),
);
export const elements = [
  { type: 'heading', name: 'Heading', category: 'Text', create: () => h('Your heading') },
  {
    type: 'text',
    name: 'Paragraph',
    category: 'Text',
    create: () => p('Tell your story in your own words.'),
  },
  {
    type: 'button',
    name: 'Button / link',
    category: 'Actions',
    create: () => link('Explore more', ''),
  },
  { type: 'image', name: 'Image', category: 'Media', create: () => image() },
  {
    type: 'gallery',
    name: 'Gallery',
    category: 'Media',
    create: (data) => node('gallery', { assetIds: assets(data).slice(0, 6) }),
  },
  { type: 'divider', name: 'Divider', category: 'Layout', create: () => node('divider') },
  {
    type: 'spacer',
    name: 'Space',
    category: 'Layout',
    create: () => ({ ...node('spacer'), style: { height: 40 } }),
  },
  {
    type: 'container',
    name: 'Container',
    category: 'Layout',
    create: () => group([p('Add your content.')], { padding: 24 }),
  },
  {
    type: 'columns',
    name: 'Columns',
    category: 'Layout',
    create: () => columns([group([h('First column', 3)]), group([h('Second column', 3)])]),
  },
  {
    type: 'section',
    name: 'Section',
    category: 'Layout',
    create: () => section('New section', [h('Your next section.')]),
  },
  ...sectionPresets
    .filter((p) => ['collection', 'services', 'programme', 'rsvp-inline'].includes(p.id))
    .map((p) => ({ ...p, type: p.id, create: (data) => p.create(data) })),
];
const specifications = [
  [
    'storefront-editorial',
    'Storefront editorial',
    'Storefront',
    'A complete shop: image-led introduction, live collection, brand story, shopping guide and contact footer.',
    ['products'],
  ],
  [
    'storefront-compact',
    'Storefront compact',
    'Storefront',
    'A focused shop: introduction, featured products, story, shopping answers and social footer.',
    ['products'],
  ],
  [
    'wedding-editorial',
    'Wedding editorial',
    'Wedding',
    'The complete invitation: story, people, countdown, programme, venue, guest information and connected RSVP.',
    ['event', 'rsvp'],
  ],
  [
    'wedding-garden',
    'Wedding garden',
    'Wedding',
    'A botanical invitation with generous photography, the day’s programme, venue, guest information and split RSVP.',
    ['event', 'rsvp'],
  ],
  [
    'landing-minimal',
    'Landing minimal',
    'Landing page',
    'A complete introduction: story, approach, gallery, questions, contact details and social footer.',
    [],
  ],
  [
    'landing-image-led',
    'Landing image-led',
    'Landing page',
    'A photographic landing page with a full-width opening, story, approach, gallery and contact footer.',
    [],
  ],
];
export const templates = specifications.map(([id, name, category, description, requires]) => ({
  id,
  name,
  category,
  description,
  requires,
  mode: category === 'Landing page' ? 'fixed' : 'live',
  create(data = {}) {
    return createPremade(id, name, category, data);
  },
}));
export function applyTemplate(id, data = {}) {
  const aliases = {
    storefront: 'storefront-editorial',
    event: 'wedding-editorial',
    landing: 'landing-minimal',
    clinic: 'landing-minimal',
  };
  const item = templates.find((t) => t.id === (aliases[id] || id));
  if (!item) throw new Error('Template not found.');
  return cloneNode(item.create(data));
}

const questions = () => [
  { title: 'What should visitors know?', body: 'Add a clear answer to a common question.' },
  {
    title: 'How can we get in touch?',
    body: 'Include your contact details and when people can expect a response.',
  },
];
sectionPresets.push(
  preset(
    'faq-list',
    'Frequently asked questions',
    'Information',
    'Clear answers in a compact, accessible accordion.',
    () =>
      section('Frequently asked questions', [
        h('Good to know'),
        node('accordion', { items: questions() }),
      ]),
  ),
  preset(
    'content-tabs',
    'Tabbed information',
    'Information',
    'Organize related content into keyboard-accessible tabs.',
    () =>
      section('Explore the details', [
        h('A closer look'),
        node('tabs', {
          items: [
            { title: 'Overview', body: 'Introduce what makes this offering useful.' },
            { title: 'Details', body: 'Add practical details, materials or requirements.' },
            { title: 'Care', body: 'Share how to get the most from it.' },
          ],
        }),
      ]),
  ),
  preset(
    'contact-links',
    'Contact details',
    'Contact',
    'Editable contact links without a disconnected submission form.',
    () =>
      section('Contact', [
        columns([
          group([h('Let’s talk.'), p('Add your address and the best time to reach your team.')]),
          group([
            link('Email us', 'mailto:hello@example.com'),
            p('Replace the example email before publishing.'),
            link('Call us', 'tel:+0000000000'),
            p('Replace the example phone number before publishing.'),
          ]),
        ]),
      ]),
  ),
  preset(
    'location-link',
    'Location & directions',
    'Contact',
    'A location block with a map link that opens on request.',
    () =>
      section('Visit us', [
        h('Find your way here.'),
        p('Add your venue or business address.'),
        link('Open directions', 'https://www.google.com/maps'),
      ]),
  ),
  preset(
    'opening-hours',
    'Opening hours',
    'Contact',
    'A readable weekly schedule using your website typography.',
    () =>
      section('Opening hours', [
        columns([
          group([h('Plan your visit.'), p('Set your actual hours before publishing.')]),
          group([
            h('Weekdays', 3),
            p('Add opening and closing times.'),
            h('Weekends', 3),
            p('Add weekend hours or closure information.'),
          ]),
        ]),
      ]),
  ),
  preset(
    'video-story',
    'Video & story',
    'Media',
    'A native, user-controlled video from your project library.',
    (data) =>
      section('Watch our story', [
        h('See it in motion.'),
        node('video', {
          assetId:
            Object.entries(data?.assets || {}).find(([, a]) => a.type === 'video')?.[0] || '',
          alt: 'Add a description of this video.',
          caption: 'Add a transcript link or summary below.',
        }),
        p(
          'Include a transcript and ensure the source video contains captions when speech is present.',
        ),
      ]),
  ),
  preset(
    'logo-list',
    'Logo list',
    'Media',
    'A responsive row of approved logos; select images in the inspector.',
    (data) =>
      section('Logo list', [
        h('People we work with.'),
        node('gallery', { assetIds: assets(data).slice(0, 6), variant: 'logos' }),
      ]),
  ),
  preset(
    'feature-columns',
    'Features & services',
    'Information',
    'An editable feature layout with responsive columns.',
    () =>
      section('Features', [
        h('Made around your needs.'),
        columns([
          group([
            h('First feature', 3),
            p('Describe a useful feature or service.'),
            link('Learn more', '#contact'),
          ]),
          group([
            h('Second feature', 3),
            p('Explain what visitors can expect.'),
            link('Learn more', '#contact'),
          ]),
          group([
            h('Third feature', 3),
            p('Add a meaningful reason to explore further.'),
            link('Learn more', '#contact'),
          ]),
        ]),
      ]),
  ),
);
elements.push(
  {
    type: 'accordion',
    name: 'FAQ accordion',
    category: 'Information',
    create: () => node('accordion', { items: questions() }),
  },
  {
    type: 'tabs',
    name: 'Content tabs',
    category: 'Information',
    create: () => node('tabs', { items: questions() }),
  },
  {
    type: 'video',
    name: 'Video',
    category: 'Media',
    create: (data) =>
      node('video', {
        assetId: Object.entries(data?.assets || {}).find(([, a]) => a.type === 'video')?.[0] || '',
        alt: 'Video',
      }),
  },
);

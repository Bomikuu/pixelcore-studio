import { safeUrl } from '@sitebuilder/core';
export const widgetIds = [
  'pixelcore.event-rsvp',
  'pixelcore.event-people',
  'pixelcore.event-story',
  'pixelcore.event-countdown',
  'pixelcore.event-venue',
  'pixelcore.event-notes',
  'pixelcore.event-gifts',
  'pixelcore.event-wishes',
  'pixelcore.social-links',
];
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const safe = (value) => esc(safeUrl(value));
export function renderWidget(n, data, mode) {
  const event = data.event || {},
    type = n.props.widgetId,
    preview = mode !== 'public',
    variant = n.props.variant || 'inline';
  if (type === 'pixelcore.event-rsvp') {
    const settings = event.rsvp || {},
      label = n.props.text || settings.heading || 'Will you join us?';
    const previewForm = `<div class="wb-rsvp-sample" aria-label="Sample RSVP form"><p class="wb-widget-note">Sample invitation · preview only</p><p>For Sample guest</p><div class="wb-rsvp-options"><span>Attending</span><span>Not attending</span>${settings.allow_maybe ? '<span>Maybe</span>' : ''}</div><div class="wb-rsvp-field">Number attending</div>${settings.show_dietary_notes !== false ? '<div class="wb-rsvp-field">Dietary and accessibility notes</div>' : ''}<span class="wb-action">${esc(settings.submit_label || 'Send response')}</span><p class="wb-widget-note">This preview cannot submit a guest response.</p></div>`;
    return `<div class="wb-rsvp wb-rsvp-${esc(variant)}"><div><h2>${esc(label)}</h2><p>${esc(settings.intro || 'We’d love to celebrate with you.')}</p>${event.deadlineLabel ? `<p>${esc(event.deadlineLabel)}</p>` : ''}</div>${preview && variant !== 'cta' ? previewForm : `<div><p>${esc(event.rsvpOpen === false ? 'Responses are currently closed.' : 'Please open your private invitation link to respond.')}</p><span class="wb-widget-note">Your reply stays connected to your invitation.</span></div>`}</div>`;
  }
  if (type === 'pixelcore.event-countdown') {
    const days = Number.isFinite(event.countdownDays) ? Math.max(0, event.countdownDays) : null;
    return days === null
      ? '<p>The countdown will appear when an event date is connected.</p>'
      : `<div class="wb-countdown"><strong>${esc(days)}</strong><span>${days === 1 ? 'day' : 'days'} until ${esc(event.title || 'the occasion')}</span><time>${esc(event.date || '')}</time></div>`;
  }
  if (type === 'pixelcore.event-venue')
    return `<p>${esc(event.venueAddress || event.venue || 'Venue details to follow.')}</p>${safe(event.mapUrl) ? `<a class="wb-action"${mode === 'public' ? ` href="${safe(event.mapUrl)}" target="_blank" rel="noopener noreferrer"` : ' aria-disabled="true"'}>Get directions</a>` : ''}`;
  let rows =
    type === 'pixelcore.event-people'
      ? event.people
      : type === 'pixelcore.event-story'
        ? event.stories
        : type === 'pixelcore.event-notes'
          ? event.notes
          : type === 'pixelcore.event-gifts'
            ? event.gifts
            : type === 'pixelcore.event-wishes'
              ? event.wishes
              : type === 'pixelcore.social-links'
                ? data.identity?.socials
                : [];
  rows = Array.isArray(rows) ? rows : [];
  if (!rows.length)
    return `<p class="wb-widget-note">${mode === 'public' ? 'Details to follow.' : 'Connect this event’s approved content in the source settings.'}</p>`;
  return `<div class="wb-widget-items">${rows
    .slice(0, 30)
    .map(
      (r) =>
        `<article>${r.title || r.name ? `<h3>${esc(r.title || r.name)}</h3>` : ''}${r.body || r.role || r.message ? `<p>${esc(r.body || r.role || r.message)}</p>` : ''}${safe(r.url) ? `<a${mode === 'public' ? ` href="${safe(r.url)}" rel="noopener noreferrer"` : ' aria-disabled="true"'}>${esc(r.label || r.platform || 'Learn more')}</a>` : ''}</article>`,
    )
    .join('')}</div>`;
}
export function renderRegion(n, data, mode) {
  const identity = data.identity || {},
    event = data.event || {},
    wedding =
      n.props.source === 'event' || n.props.variant === 'wedding' || n.props.variant === 'monogram';
  const title = wedding ? event.title || identity.name : identity.name;
  const nav = Array.isArray(data.navigation) ? data.navigation : [];
  const links = nav
    .slice(0, 8)
    .map(
      (item) =>
        `<a${mode === 'public' && safe(item.href || item.path) ? ` href="${safe(item.href || item.path)}"` : ' aria-disabled="true"'}>${esc(item.label)}</a>`,
    )
    .join('');
  if (n.type === 'header')
    return `<div class="wb-header-inner"><a class="wb-wordmark"${mode === 'public' ? ` href="${safe(identity.homeUrl) || '/'}"` : ' aria-disabled="true"'}>${identity.logo ? `<img src="${safe(identity.logo)}" alt="" width="36" height="36">` : ''}${esc(title || 'Your website')}</a><nav aria-label="Website navigation">${links}</nav></div>`;
  const socials = (Array.isArray(identity.socials) ? identity.socials : [])
    .filter(
      (item) =>
        item && safeUrl(item.url) && /^https?:/i.test(item.url) && (item.platform || item.label),
    )
    .slice(0, 12)
    .map(
      (item) =>
        `<a${mode === 'public' ? ` href="${safe(item.url)}" target="_blank" rel="noopener noreferrer"` : ' aria-disabled="true"'}>${esc(item.label || item.platform)}</a>`,
    )
    .join('');
  const contactLink = (label, href) =>
    safeUrl(href)
      ? `<a${mode === 'public' ? ` href="${safe(href)}"` : ' aria-disabled="true"'}>${esc(label)}</a>`
      : esc(label);
  const contact = [
    identity.address ? `<span>${esc(identity.address)}</span>` : '',
    identity.email ? contactLink(identity.email, `mailto:${identity.email}`) : '',
    identity.phone
      ? contactLink(identity.phone, `tel:${String(identity.phone).replace(/[^+\d]/g, '')}`)
      : '',
  ]
    .filter(Boolean)
    .join('');
  return `<div class="wb-footer-inner"><div><h2>${esc(title || 'Your website')}</h2><p>${esc(wedding ? 'We look forward to celebrating with you.' : identity.description || '')}</p>${socials ? `<nav class="wb-social-links" aria-label="Social media">${socials}</nav>` : ''}</div>${links ? `<nav aria-label="Footer navigation">${links}</nav>` : ''}${contact ? `<address aria-label="Contact details">${contact}</address>` : ''}</div><p class="wb-footer-note">${esc(wedding ? 'With love, always.' : identity.copyright || identity.name || '')}</p>`;
}
export const widgetCss = `.wb-header{padding:24px max(28px,6%);border-bottom:1px solid var(--wb-border)}.wb-header-inner{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:36px}.wb-header nav,.wb-footer nav{display:flex;gap:24px;flex-wrap:wrap;font:500 .8em var(--wb-body-font),sans-serif}.wb-wordmark{display:flex;align-items:center;gap:12px;font-weight:600;text-decoration:none}.wb-wordmark img{max-width:40px;max-height:40px}.wb-header-center .wb-header-inner,.wb-header-monogram .wb-header-inner{flex-direction:column;gap:16px}.wb-header-monogram .wb-wordmark{font:500 1.5em var(--wb-heading-font),serif}.wb-footer{padding:60px max(28px,6%) 24px;background:var(--wb-surface);border-top:1px solid var(--wb-border)}.wb-footer-inner{display:grid;grid-template-columns:2fr 1fr 1fr;gap:36px}.wb-footer-inner h2{font-size:1.5em}.wb-footer address{display:flex;flex-direction:column;gap:8px;font-size:.85em;font-style:normal}.wb-footer-inner>nav{flex-direction:column;align-items:flex-start;gap:8px}.wb-footer .wb-social-links{gap:8px 20px;margin-top:20px}.wb-header nav a,.wb-footer nav a,.wb-footer address a{display:inline-flex;align-items:center;min-height:44px}.wb-footer h2{max-width:none}.wb-wordmark{min-width:0;overflow-wrap:anywhere}.wb-header nav{justify-content:flex-end}.wb-footer-note{font-size:.75em;color:var(--wb-muted);padding-top:24px!important;margin:20px 0 0!important;border-top:1px solid var(--wb-border)}.wb-footer-wedding{text-align:center}.wb-footer-wedding .wb-footer-inner{display:block}.wb-footer-wedding nav{justify-content:center;align-items:center}.wb-footer-wedding .wb-footer-inner>nav{flex-direction:row}.wb-footer-wedding address{align-items:center;margin-top:20px}.wb-footer-compact .wb-footer-inner{grid-template-columns:2fr 1fr}.wb-widget{min-width:0}.wb-rsvp{padding:40px;border:1px solid var(--wb-border);border-radius:var(--wb-radius);background:var(--wb-surface);max-width:760px;margin:auto}.wb-rsvp-split{display:grid;grid-template-columns:1fr 1fr;gap:40px;max-width:none}.wb-rsvp h2{font-size:clamp(1.75rem,3vw,3rem)}.wb-rsvp-options{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.wb-rsvp-options span{padding:10px 14px;border:1px solid var(--wb-border);border-radius:var(--wb-radius);font-size:.85em}.wb-rsvp-field{padding:12px;border:1px solid var(--wb-border);margin:12px 0;color:var(--wb-muted);font-size:.85em}.wb-widget-note{font-size:.8em;color:var(--wb-muted);margin:12px 0!important}.wb-countdown{display:flex;flex-direction:column;gap:8px}.wb-countdown strong{font:500 clamp(3rem,6vw,6rem) var(--wb-heading-font),serif}.wb-countdown time{font-size:.85em;color:var(--wb-muted)}.wb-widget-items{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:32px}.wb-widget-items h3{font-size:1.35em}.wb-widget-items p{font-size:.95em}.wb-columns figure img{width:100%;aspect-ratio:4/5;object-fit:cover}.wb-section>figure img{width:100%;max-height:640px;object-fit:cover}.wb-page [data-wb-content]{min-width:0}.wb-page section[id]{scroll-margin-top:80px}@media(max-width:700px){.wb-header-inner{align-items:flex-start;flex-direction:column}.wb-header nav{gap:16px;font-size:.85em}.wb-header{padding:20px 24px}.wb-footer{padding:36px 24px 20px}.wb-footer-inner,.wb-footer-compact .wb-footer-inner,.wb-rsvp-split{grid-template-columns:1fr}.wb-header nav{justify-content:flex-start}.wb-footer-inner>nav{flex-direction:row;gap:8px 24px}.wb-rsvp{padding:24px}.wb-rsvp-split{gap:20px}}`;

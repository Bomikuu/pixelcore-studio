import copy
from django.core.exceptions import ValidationError
from django.test import TestCase
from website_builder.models import Website
from website_builder.services.revisions import save_draft, publish
from website_builder.services.globals import create_section, publish_section, update_section
from .test_services import document


class ContentModeTests(TestCase):
    def test_fixed_publication_rejects_live_body_without_discarding_saved_draft(self):
        for kind, props in [('products', {'source': 'products'}), ('text', {'text': {'source': 'identity', 'path': 'name'}}), ('widget', {'widgetId': 'pixelcore.event-rsvp'})]:
            with self.subTest(kind=kind):
                source = document()
                source['children'][0].update(type=kind, props=props)
                site = Website.objects.create(tenant='mode', key=kind)
                site = save_draft(site.id, source, 0)
                with self.assertRaisesMessage(ValidationError, 'fixed page contains live content'):
                    publish(site.id, site.version)
                site.refresh_from_db()
                self.assertIsNone(site.published_id)
                self.assertEqual(site.draft.document, source)

    def test_live_publication_retains_bindings_and_fixed_allows_shared_frame(self):
        source = document()
        header = copy.deepcopy(source['children'][0])
        header.update(id='header', type='header', props={'source': 'identity'}, children=[])
        source['children'].insert(0, header)
        site = Website.objects.create(tenant='mode', key='authored')
        site = save_draft(site.id, source, 0)
        self.assertIsNotNone(publish(site.id, site.version).published_id)
        source['mode'] = 'live'
        source['children'][1]['props']['text'] = {'source': 'event', 'path': 'title'}
        site = save_draft(site.id, source, site.version)
        self.assertIsNotNone(publish(site.id, site.version).published_id)

    def test_published_shared_source_cannot_hide_live_content_from_fixed_check(self):
        source = document()
        live = copy.deepcopy(source['children'][0])
        live.update(id='live-row', type='products', props={'source': 'products'})
        section = dict(id='source-section', type='section', props={'name': 'Collection'}, style={}, responsive={}, children=[live])
        site = Website.objects.create(tenant='mode', key='linked')
        site = save_draft(site.id, document(), 0)
        shared = create_section(site, 'Collection', section)
        publish_section(shared.id, 'mode', 1)
        fallback = copy.deepcopy(section)
        fallback['children'] = []
        source['children'] = [dict(id='link', type='global-section', props={'sectionId': str(shared.id)}, style={}, responsive={}, children=[fallback])]
        site = save_draft(site.id, source, site.version)
        with self.assertRaisesMessage(ValidationError, 'fixed page contains live content'):
            publish(site.id, site.version)

    def test_shared_publication_cannot_turn_an_existing_fixed_page_live(self):
        site = Website.objects.create(tenant='mode', key='existing-fixed')
        site = save_draft(site.id, document(), 0)
        section = dict(id='source', type='section', props={'name': 'Shared'}, style={}, responsive={}, children=copy.deepcopy(document()['children']))
        shared = create_section(site, 'Shared', section)
        publish_section(shared.id, 'mode', 1)
        source = document()
        source['children'] = [dict(id='link', type='global-section', props={'sectionId': str(shared.id)}, style={}, responsive={}, children=[copy.deepcopy(section)])]
        site = save_draft(site.id, source, site.version)
        publish(site.id, site.version)
        section['children'][0]['props']['text'] = {'source': 'event', 'path': 'title'}
        update_section(shared.id, site, section, 1)
        with self.assertRaisesMessage(ValidationError, 'fixed page contains live content'):
            publish_section(shared.id, 'mode', 2)
        shared.refresh_from_db()
        self.assertEqual(shared.published.number, 1)

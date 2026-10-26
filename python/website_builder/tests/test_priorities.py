import copy
from django.test import TestCase, override_settings
from django.core.exceptions import ValidationError
from website_builder.models import Website, GlobalSectionRevision
from website_builder.services.revisions import save_draft, publish, restore_revision, create_review, VersionConflict
from website_builder.services.globals import create_section, update_section, publish_section, resolve_global_sections
from website_builder.validation import validate_document
from .test_services import document


def section(text='Global original'):
    return {'id': 'shared-section', 'type': 'section', 'props': {'name': 'Shared'}, 'style': {}, 'responsive': {}, 'children': [
        {'id': 'shared-copy', 'type': 'text', 'props': {'text': text}, 'style': {}, 'responsive': {}, 'children': []}]}


def link(identifier):
    return {'id': 'linked-node', 'type': 'global-section', 'props': {'sectionId': str(identifier)}, 'style': {}, 'responsive': {}, 'children': [section('Offline fallback')]}


@override_settings(WEBSITE_BUILDER_AUTHORIZE=lambda request, site, action: site.tenant == 'local-demo')
class PriorityTests(TestCase):
    def setUp(self):
        self.site = save_draft(Website.objects.create(tenant='local-demo', key='priorities').id, document(), 0)
        self.path = f'/api/website-builder/sites/{self.site.id}/'

    def post(self, path, data): return self.client.post(path, data=data, content_type='application/json')

    def test_history_restores_as_new_draft_without_changing_live_or_old_revision(self):
        first = self.site.draft
        publish(self.site.id, 1)
        changed = document(); changed['title'] = 'Later draft'
        save_draft(self.site.id, changed, 1)
        listing = self.client.get(self.path + 'revisions/').json()['revisions']
        self.assertEqual([r['number'] for r in listing], [2, 1])
        self.assertTrue(listing[0]['isDraft']); self.assertTrue(listing[1]['isPublished'])
        detail = self.client.get(self.path + f'revisions/{first.id}/').json()['revision']
        self.assertEqual(detail['document']['title'], 'Review')
        result = self.post(self.path + f'revisions/{first.id}/restore/', {'expectedVersion': 2})
        self.assertEqual(result.status_code, 200, result.content)
        self.assertEqual(result.json()['version'], 3)
        self.assertEqual(result.json()['publishedRevision'], str(first.id))
        first.refresh_from_db(); self.assertEqual(first.document['title'], 'Review')
        self.assertEqual(self.post(self.path + f'revisions/{first.id}/restore/', {'expectedVersion': 2}).status_code, 409)
        self.site.refresh_from_db(); self.assertEqual(self.site.revisions.count(), 3)

    def test_history_and_recovery_identity_are_tenant_user_scoped(self):
        other = save_draft(Website.objects.create(tenant='another-tenant', key='private').id, document(), 0)
        self.assertEqual(self.client.get(self.path + f'revisions/{other.draft_id}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/website-builder/sites/{other.id}/revisions/').status_code, 401)
        initial = self.client.get(self.path).json()['capabilities']['workspace']['recoveryScope']
        self.assertEqual(initial, self.client.get(self.path).json()['capabilities']['workspace']['recoveryScope'])
        sibling = save_draft(Website.objects.create(tenant='local-demo', key='sibling').id, document(), 0)
        self.assertNotEqual(initial, self.client.get(f'/api/website-builder/sites/{sibling.id}/').json()['capabilities']['workspace']['recoveryScope'])

    def test_global_section_drafts_publications_and_reviews_are_independent(self):
        shared = create_section(self.site, 'Banner', section())
        source = document(); source['children'] = [link(shared.id)]
        self.site = save_draft(self.site.id, source, 1)
        with self.assertRaises(ValidationError): publish(self.site.id, 2)
        self.assertEqual(resolve_global_sections('local-demo', source, {})['globalSections'], {})
        publish_section(shared.id, 'local-demo', 1)
        published = publish(self.site.id, 2)
        frozen = resolve_global_sections('local-demo', source, {}, stage='draft')
        review, _ = create_review(self.site.id, 2, frozen)
        first = shared.draft
        changed = update_section(shared.id, self.site, section('Edited later'), 1)
        self.assertEqual(resolve_global_sections('local-demo', source, {})['globalSections'][str(shared.id)]['node']['children'][0]['props']['text'], 'Global original')
        self.assertEqual(resolve_global_sections('local-demo', source, {}, stage='draft')['globalSections'][str(shared.id)]['version'], 2)
        publish_section(changed.id, 'local-demo', 2)
        review.refresh_from_db(); self.assertEqual(review.data_snapshot['globalSections'][str(shared.id)]['version'], 1)
        from website_builder.services.reviews import add_comment
        thread = add_comment(review.id, display_name='Reviewer', body='Linked text', anchor={'nodeId': 'shared-copy'})
        self.assertEqual(thread.node_id, 'shared-copy')
        self.site.refresh_from_db(); self.assertEqual(self.site.published_id, published.published_id)
        first.node = section('Mutate')
        with self.assertRaises(ValueError): first.save()

    def test_global_api_reports_affected_pages_and_enforces_optimistic_updates(self):
        response = self.post(self.path + 'globals/', {'name': 'Banner', 'node': section()})
        self.assertEqual(response.status_code, 200, response.content)
        shared = response.json()['section']; self.assertIsNone(shared['publishedVersion']); self.assertEqual(shared['version'], 1)
        source = document(); source['children'] = [link(shared['id'])]
        self.site = save_draft(self.site.id, source, 1)
        path = self.path + f'globals/{shared["id"]}/'
        self.assertEqual(self.client.get(path).json()['section']['affectedPages'][0]['id'], str(self.site.id))
        bad = self.client.put(path, data={'node': section(), 'expectedVersion': 0}, content_type='application/json')
        self.assertEqual(bad.status_code, 409)
        self.assertEqual(GlobalSectionRevision.objects.count(), 1)
        live = self.post(path + 'publish/', {'expectedVersion': 1})
        self.assertEqual(live.json()['section']['publishedVersion'], 1)
        self.assertEqual(self.post(path + 'publish/', {'expectedVersion': True}).status_code, 400)

    def test_cross_tenant_globals_cannot_be_read_resolved_or_updated(self):
        private_site = save_draft(Website.objects.create(tenant='another-tenant', key='private').id, document(), 0)
        shared = create_section(private_site, 'Private', section('Private text'))
        publish_section(shared.id, private_site.tenant, 1)
        path = self.path + f'globals/{shared.id}/'
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.put(path, data={'node': section(), 'expectedVersion': 1}, content_type='application/json').status_code, 404)
        self.assertEqual(self.client.get(self.path + 'globals/').json()['sections'], [])
        source = document(); source['children'] = [link(shared.id)]
        self.assertEqual(resolve_global_sections(self.site.tenant, source, {})['globalSections'], {})
        self.assertEqual(self.post(path + 'publish/', {'expectedVersion': 1}).status_code, 404)

    def test_global_links_cannot_recurse_or_save_executable_content(self):
        source = document(); source['children'] = [link('missing')]
        validate_document(source)
        nested = section(); nested['children'] = [link('missing')]
        with self.assertRaises(ValidationError): create_section(self.site, 'Recursive', nested)
        source['children'][0]['children'][0]['children'] = [link('missing')]
        with self.assertRaises(ValidationError): validate_document(source)
        self.assertEqual(self.post(self.path + 'globals/', {'name': 'Invalid', 'node': {'type': 'section', 'props': {'html': '<script>'}}}).status_code, 400)

    def test_global_publish_validation_failure_rolls_back_pointer(self):
        shared = create_section(self.site, 'Banner', section())
        with override_settings(WEBSITE_BUILDER_VALIDATE_GLOBAL_PUBLISH=lambda *args: (_ for _ in ()).throw(ValidationError('Host rejected publication'))):
            self.assertEqual(self.post(self.path + f'globals/{shared.id}/publish/', {'expectedVersion': 1}).status_code, 400)
        shared.refresh_from_db(); self.assertIsNone(shared.published_id)

    def test_typed_bindings_repeaters_and_responsive_styles_roundtrip(self):
        source = document()
        card = section(); card['type'] = 'container'
        card['children'][0]['props']['text'] = {'source': 'item', 'path': 'base_price', 'format': 'currency'}
        source['children'] = [{'id': 'products', 'type': 'repeater', 'props': {'source': 'products', 'limit': 12, 'offset': 0, 'sortField': 'base_price', 'sortDirection': 'asc', 'filterField': 'category', 'filterValue': 'clothing', 'emptyText': 'No products'}, 'children': [card], 'style': {'paddingTop': 24, 'width': 100, 'minWidth': 0, 'flexWrap': 'wrap', 'justifyContent': 'space-between'}, 'responsive': {'tablet': {'flexDirection': 'column'}, 'phone': {'paddingLeft': 16, 'display': 'none'}}}]
        saved = save_draft(self.site.id, source, 1)
        self.assertEqual(saved.draft.document, source)
        for key in ('href', 'assetId', 'alt'):
            source['children'][0]['children'][0]['children'][0]['props'][key] = {'source': 'item', 'path': key}
        validate_document(source)

    def test_private_sources_and_unbounded_repeater_inputs_are_rejected(self):
        for binding in ({'source': 'guests', 'path': 'dietary_notes'}, {'source': 'identity', 'path': '__proto__.name'}, {'source': 'item', 'path': 'href', 'format': 'html'}):
            source = document(); source['children'][0]['props']['text'] = binding
            with self.assertRaises(ValidationError): validate_document(source)
        for props in ({'source': 'guests'}, {'source': 'products', 'offset': -1}, {'source': 'products', 'sortField': '__proto__'}, {'source': 'products', 'filterValue': 'x' * 201}):
            source = document(); source['children'] = [{'id': 'repeater', 'type': 'repeater', 'props': props, 'children': [section()], 'style': {}, 'responsive': {}}]
            with self.assertRaises(ValidationError): validate_document(source)

    def test_repeater_cards_cannot_duplicate_operational_or_linked_components(self):
        for kind in ('widget', 'header', 'footer', 'global-section', 'repeater'):
            forbidden = {'id': 'forbidden-card-child', 'type': kind, 'props': {}, 'style': {}, 'responsive': {}, 'children': []}
            if kind == 'widget': forbidden['props'] = {'widgetId': 'pixelcore.event-rsvp', 'source': 'event'}
            if kind == 'global-section': forbidden.update(props={'sectionId': 'shared'}, children=[section()])
            if kind == 'repeater': forbidden.update(props={'source': 'products'}, children=[section()])
            card = {'id': 'card', 'type': 'container', 'props': {}, 'style': {}, 'responsive': {}, 'children': [forbidden]}
            source = document(); source['children'] = [{'id': 'list', 'type': 'repeater', 'props': {'source': 'products'}, 'style': {}, 'responsive': {}, 'children': [card]}]
            with self.subTest(kind=kind):
                with self.assertRaisesMessage(ValidationError, 'Repeater cards cannot contain'): validate_document(source)

    def test_anonymous_documents_never_serialize_unpublished_global_fallbacks(self):
        from website_builder.services.globals import public_document
        from django.core.exceptions import PermissionDenied
        shared = create_section(self.site, 'Public banner', section('Published only'))
        publish_section(shared.id, self.site.tenant, 1)
        update_section(shared.id, self.site, section('Secret unpublished edit'), 1)
        source = document(); reference = link(shared.id); reference['children'] = [section('Secret unpublished edit')]
        source['children'] = [reference, copy.deepcopy(reference)]; source['children'][1]['id'] = 'second-link'
        # Duplicated copied IDs are not valid stored page documents; use separate fallback IDs.
        source['children'][1]['children'][0]['id'] = 'second-fallback'
        source['children'][1]['children'][0]['children'][0]['id'] = 'second-copy'
        self.site = save_draft(self.site.id, source, 1); self.site = publish(self.site.id, 2)
        public = public_document(self.site.tenant, self.site.published.document)
        self.assertIn('Published only', str(public)); self.assertNotIn('Secret unpublished edit', str(public))
        validate_document(public)
        self.site.published.refresh_from_db(); self.assertIn('Secret unpublished edit', str(self.site.published.document))
        response = self.client.get(f'/api/demo/published/{self.site.id}/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertNotIn('Secret unpublished edit', response.content.decode())
        self.assertNotEqual(public['children'][0]['children'][0]['id'], public['children'][1]['children'][0]['id'])
        from website_builder.models import GlobalSection
        GlobalSection.objects.filter(pk=shared.id).update(published=None)
        with self.assertRaises(PermissionDenied): public_document(self.site.tenant, self.site.published.document)

    def test_global_growth_cannot_break_existing_live_page_element_limit(self):
        shared = create_section(self.site, 'At capacity', section('Published global'))
        publish_section(shared.id, self.site.tenant, 1)
        source = document(); source['children'] = [link(shared.id)]
        source['children'] += [{'id': f'local-{index}', 'type': 'text', 'props': {'text': 'Local copy'}, 'style': {}, 'responsive': {}, 'children': []} for index in range(496)]
        self.site = save_draft(self.site.id, source, 1); self.site = publish(self.site.id, 2)
        expanded = section('New global draft')
        expanded['children'].append({'id': 'one-extra-node', 'type': 'text', 'props': {'text': 'Too large for live page'}, 'style': {}, 'responsive': {}, 'children': []})
        shared = update_section(shared.id, self.site, expanded, 1)
        with self.assertRaisesMessage(ValidationError, 'affected page would be unavailable'):
            publish_section(shared.id, self.site.tenant, 2)
        shared.refresh_from_db(); self.assertEqual(shared.published.number, 1)
        self.assertEqual(shared.draft.number, 2)
        from website_builder.services.globals import public_document
        self.assertIn('Published global', str(public_document(self.site.tenant, self.site.published.document)))

    def test_page_publish_validates_expanded_global_size_without_host_hooks(self):
        global_node = section('Published global')
        global_node['children'].append({'id': 'additional-published-node', 'type': 'text', 'props': {'text': 'Published extra'}, 'style': {}, 'responsive': {}, 'children': []})
        shared = create_section(self.site, 'Larger published section', global_node)
        publish_section(shared.id, self.site.tenant, 1)
        source = document(); source['children'] = [link(shared.id)]
        source['children'] += [{'id': f'local-{index}', 'type': 'text', 'props': {'text': 'Local copy'}, 'style': {}, 'responsive': {}, 'children': []} for index in range(496)]
        self.site = save_draft(self.site.id, source, 1)
        with self.assertRaisesMessage(ValidationError, 'This page cannot be published'):
            publish(self.site.id, 2)
        self.site.refresh_from_db(); self.assertIsNone(self.site.published_id)

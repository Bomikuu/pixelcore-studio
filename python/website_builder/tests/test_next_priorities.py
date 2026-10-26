import copy
import tempfile
from io import BytesIO
from django.test import TestCase, override_settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from website_builder.models import Website, SavedTemplate, SavedTemplateRevision, SavedSection, DemoMedia
from website_builder.services.revisions import save_draft, publish
from website_builder.validation import validate_document, template_document
from website_builder.services.media import prepare_image
from .test_services import document


def image_upload(width=1400, height=800):
    output = BytesIO(); Image.new('RGB', (width, height), 'navy').save(output, 'PNG')
    return SimpleUploadedFile('sample.png', output.getvalue(), content_type='image/png')


@override_settings(WEBSITE_BUILDER_AUTHORIZE=lambda request, site, action: site.tenant == 'local-demo')
class NextPriorityTests(TestCase):
    def setUp(self):
        self.site = save_draft(Website.objects.create(tenant='local-demo', key='next').id, document(), 0)
        self.path = f'/api/website-builder/sites/{self.site.id}/'

    def post(self, path, value): return self.client.post(path, data=value, content_type='application/json')
    def put(self, path, value): return self.client.put(path, data=value, content_type='application/json')
    def template(self):
        response = self.post(self.path + 'templates/', {'name': 'Original', 'tags': ['landing'], 'document': document()})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()['template']

    def test_template_versions_restore_as_new_version_and_do_not_change_published_pages(self):
        publish(self.site.id, 1)
        item = self.template(); path = self.path + f'templates/{item["id"]}/'
        original = SavedTemplateRevision.objects.get()
        changed = document(); changed['title'] = 'New template'
        result = self.put(path, {'expectedVersion': 1, 'name': 'Revised', 'document': changed, 'tags': ['event', 'event']})
        self.assertEqual(result.status_code, 200, result.content)
        self.assertEqual(result.json()['design']['version'], 2)
        self.assertEqual(result.json()['design']['tags'], ['event'])
        self.assertEqual(self.put(path, {'expectedVersion': 1, 'archived': True}).status_code, 409)
        restored = self.put(path, {'expectedVersion': 2, 'restoreVersion': 1})
        self.assertEqual(restored.json()['design']['version'], 3)
        self.assertEqual(restored.json()['design']['name'], 'Original')
        self.assertEqual(SavedTemplateRevision.objects.count(), 3)
        with self.assertRaises(ValueError): original.save()
        self.site.refresh_from_db(); self.assertEqual(self.site.version, 1); self.assertEqual(self.site.published.document, document())
        version = self.client.get(path + 'versions/2/').json()['template']
        self.assertEqual(version['document']['title'], 'New template')

    def test_archive_rename_delete_and_tenant_isolation(self):
        item = self.template(); path = self.path + f'templates/{item["id"]}/'
        result = self.put(path, {'expectedVersion': 1, 'archived': True, 'name': 'Archived layout'})
        self.assertEqual(result.json()['design']['archived'], True)
        self.assertEqual(self.client.get(self.path + 'templates/').json()['templates'][0]['name'], 'Archived layout')
        self.assertEqual(self.put(path, {'expectedVersion': 2, 'archived': False}).status_code, 200)
        private = SavedTemplate.objects.create(tenant='other', name='Private', document=document())
        hidden = self.path + f'templates/{private.id}/'
        self.assertEqual(self.client.get(hidden).status_code, 404)
        self.assertEqual(self.put(hidden, {'expectedVersion': 1, 'name': 'Forged'}).status_code, 404)
        self.assertEqual(self.client.delete(hidden, data={'expectedVersion': 1}, content_type='application/json').status_code, 404)
        self.assertEqual(self.client.delete(path, data={'expectedVersion': 2}, content_type='application/json').status_code, 409)
        self.assertEqual(self.client.delete(path, data={'expectedVersion': 3}, content_type='application/json').status_code, 200)
        self.assertFalse(SavedTemplate.objects.filter(pk=item['id']).exists())
        self.assertEqual(SavedTemplateRevision.objects.count(), 0)
        self.site.refresh_from_db(); self.assertEqual(self.site.revisions.count(), 1)

    def test_invalid_metadata_rolls_back_and_sections_can_be_managed(self):
        item = self.template(); path = self.path + f'templates/{item["id"]}/'
        for value in [{'name': ''}, {'tags': ['x'] * 11}, {'tags': [4]}, {'archived': 1}, {'document': {'type': 'bad'}}, {'restoreVersion': True}, {'name': 'x' * 101}]:
            self.assertEqual(self.put(path, {'expectedVersion': 1, **value}).status_code, 400, value)
        self.assertEqual(SavedTemplateRevision.objects.count(), 1)
        section = SavedSection.objects.create(tenant='local-demo', name='Section', node={'id': 'section', 'type': 'section'})
        path = self.path + f'sections/{section.id}/'
        self.assertEqual(self.put(path, {'expectedVersion': 1, 'name': 'Reused', 'tags': ['footer'], 'archived': True}).status_code, 200)
        self.assertEqual(self.client.get(path).json()['design']['version'], 2)
        self.assertEqual(self.client.delete(path, data={'expectedVersion': 2}, content_type='application/json').status_code, 200)

    def test_page_settings_and_new_content_validate_and_roundtrip(self):
        doc = document(); doc['seo'] = {'title': 'Search', 'description': 'Summary', 'canonical': 'https://example.test/page', 'noIndex': True, 'socialImage': 'cover'}
        for kind in ['accordion', 'tabs']:
            doc['children'].append({'id': kind, 'type': kind, 'props': {'items': [{'title': '<Question>', 'body': '<script>plain text</script>'}]}, 'children': [], 'style': {}, 'responsive': {}})
        doc['children'].append({'id': 'image', 'type': 'image', 'props': {'assetId': 'cover', 'aspect': '4/3', 'fit': 'cover', 'focalX': 20, 'focalY': 80, 'decorative': 0}, 'children': [], 'style': {}, 'responsive': {}})
        self.assertEqual(validate_document(doc), doc)
        self.assertEqual(template_document(doc)['seo'], doc['seo'])
        self.assertEqual(self.put(self.path, {'document': doc, 'expectedVersion': 1}).status_code, 200)
        self.assertEqual(self.client.get(self.path).json()['document']['seo']['noIndex'], True)

    def test_unsafe_settings_and_new_content_are_rejected(self):
        for seo in [{'canonical': 'javascript:alert(1)'}, {'canonical': '//other.test'}, {'canonical': '/relative'}, {'canonical': 'https://a.test/\nfoo'}, {'noIndex': 'false'}, {'description': 'x' * 501}, {'script': 'x'}]:
            doc = document(); doc['seo'] = seo
            with self.assertRaises(ValidationError): validate_document(doc)
        for props in [{'items': []}, {'items': [{'title': 'a', 'body': 'b', 'html': 'bad'}]}, {'items': [{'title': 'a', 'body': 'b'}] * 21}]:
            doc = document(); doc['children'][0].update(type='tabs', props=props)
            with self.assertRaises(ValidationError): validate_document(doc)
        for props in [{'aspect': 'bad'}, {'focalX': 101}, {'fit': 'fill'}, {'decorative': True}]:
            doc = document(); doc['children'][0].update(type='image', props=props)
            with self.assertRaises(ValidationError): validate_document(doc)

    def test_upload_validates_image_and_generates_optimized_dimensions(self):
        prepared = prepare_image(image_upload())
        self.assertEqual([r['width'] for r in prepared['renditions']], [640, 1280])
        result = Image.open(BytesIO(prepared['content']))
        self.assertEqual(result.format, 'WEBP'); self.assertEqual(result.size, (1400, 800))
        self.assertEqual(result.getexif(), {})
        for upload in [None, SimpleUploadedFile('fake.png', b'<svg><script/></svg>', content_type='image/png'), SimpleUploadedFile('huge.png', b'x' * (8 * 1024 * 1024 + 1))]:
            with self.assertRaises(ValidationError): prepare_image(upload)

    def test_native_upload_uses_hook_and_asset_is_available_in_draft_and_demo_storage(self):
        with tempfile.TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            response = self.client.post(self.path + 'media/', {'file': image_upload(), 'alt': 'Example image'})
            self.assertEqual(response.status_code, 200, response.content)
            item = response.json()['asset']; self.assertEqual(item['type'], 'image'); self.assertEqual(item['alt'], 'Example image')
            self.assertEqual(len(item['renditions']), 2)
            self.assertEqual(DemoMedia.objects.get().tenant, 'local-demo')
            data = self.client.get(self.path).json()['data']
            self.assertEqual(data['assets'][item['id']]['url'], item['url'])
            self.assertEqual(self.client.get(item['url']).status_code, 200)
            self.assertEqual(self.client.post(self.path + 'media/', {'file': image_upload(), 'alt': 'x' * 251}).status_code, 400)

    def test_upload_denies_guests_and_other_tenants_before_processing(self):
        private = Website.objects.create(tenant='other', key='media')
        with override_settings(WEBSITE_BUILDER_UPLOAD_MEDIA=lambda *args: self.fail('Unauthorized media hook called')):
            response = self.client.post(f'/api/website-builder/sites/{private.id}/media/', {'file': image_upload()})
            self.assertEqual(response.status_code, 401)
        self.assertEqual(DemoMedia.objects.count(), 0)
        with override_settings(WEBSITE_BUILDER_UPLOAD_MEDIA=None):
            self.assertEqual(self.client.post(self.path + 'media/', {'file': image_upload()}).status_code, 400)


    def test_failed_rendition_storage_removes_already_written_files(self):
        from unittest.mock import Mock
        from website_builder.services.media import persist_image
        storage = Mock()
        storage.save.side_effect = ['demo/main.webp', OSError('Disk unavailable')]
        with self.assertRaises(OSError): persist_image(prepare_image(image_upload()), storage, 'demo')
        storage.delete.assert_called_once_with('demo/main.webp')

    def test_existing_templates_receive_idempotent_initial_versions(self):
        from importlib import import_module
        from django.apps import apps
        row = SavedTemplate.objects.create(tenant='local-demo', name='Existing', document=document())
        seed = import_module('website_builder.migrations.0006_initial_template_versions').seed_versions
        seed(apps, None); seed(apps, None)
        self.assertEqual(row.revisions.count(), 1)
        self.assertEqual(row.revisions.get().document, document())

from django.test import TestCase
from website_builder.models import Website
from website_builder.services.revisions import save_draft,publish
from website_builder.services.workspace import website_summary
from website_builder.tests.test_services import document

class WorkspaceSummaryTests(TestCase):
    def test_summary_counts_pending_updates_and_never_counts_other_tenants(self):
        site=Website.objects.create(tenant='one',key='first')
        site=save_draft(site.pk,document(),0)
        self.assertEqual(website_summary('one')['drafts'],1)
        publish(site.pk,site.version)
        self.assertEqual(website_summary('one')['drafts'],0)
        save_draft(site.pk,document(),site.version)
        Website.objects.create(tenant='two',key='private')
        result=website_summary('one')
        self.assertEqual(result['websites'],1);self.assertEqual(result['published'],1);self.assertEqual(result['drafts'],1)
        self.assertIsNotNone(result['updatedAt'])
    def test_summary_is_not_limited_to_one_hundred_displayed_rows(self):
        Website.objects.bulk_create([Website(tenant='one',key=f'page-{number}') for number in range(105)])
        self.assertEqual(website_summary('one')['websites'],105)
        self.assertEqual(website_summary('missing')['websites'],0)

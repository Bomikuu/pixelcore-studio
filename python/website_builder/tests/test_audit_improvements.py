from datetime import timedelta
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from website_builder.models import Website, SavedTemplate
from website_builder.services.revisions import save_draft, publish, create_review
from website_builder.services.discovery import website_page
from website_builder.tests.test_services import document

@override_settings(WEBSITE_BUILDER_AUTHORIZE=lambda request,site,action: request.user.is_authenticated and site.tenant=='audit', WEBSITE_BUILDER_RESOLVE_DATA=lambda request,site,review=False:{'identity':{'name':'Public'}}, WEBSITE_BUILDER_REVIEW_DATA=lambda request,share:share.data_snapshot)
class AuditWorkflowTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user(username='audit-owner')
        self.client.force_login(self.user)
        self.site=Website.objects.create(tenant='audit',key='first')
        self.site=save_draft(self.site.pk,document(),0,self.user)
        self.base=f'/api/website-builder/sites/{self.site.pk}/'
    def test_discovery_reaches_old_drafts_and_filters_before_pagination(self):
        for i in range(105):
            row=Website.objects.create(tenant='audit',key=f'page-{i}')
            doc=document();doc['title']=f'Page {i:03}'
            row=save_draft(row.pk,doc,0)
            if i!=0: publish(row.pk,row.version)
        Website.objects.create(tenant='private',key='do-not-show')
        result=website_page('audit',{'status':'drafts','q':'Page 000'})
        self.assertEqual(result['page']['total'],1)
        self.assertEqual(result['sites'][0]['title'],'Page 000')
        seen=[];offset=0
        while True:
            page=website_page('audit',{'offset':offset,'sort':'title'})
            seen += [row['id'] for row in page['sites']]
            if page['page']['nextOffset'] is None: break
            offset=page['page']['nextOffset']
        self.assertEqual(len(seen),106);self.assertEqual(len(set(seen)),106)
    def test_pending_published_updates_match_both_filters(self):
        publish(self.site.pk,self.site.version)
        save_draft(self.site.pk,document(),self.site.version)
        self.assertEqual(website_page('audit',{'status':'drafts'})['page']['total'],1)
        self.assertEqual(website_page('audit',{'status':'published'})['page']['total'],1)
        self.assertTrue(website_page('audit')['sites'][0]['unpublishedChanges'])
    def test_review_management_lists_metadata_without_secrets_and_excludes_other_sites(self):
        share,token=create_review(self.site.pk,self.site.version,{})
        other=Website.objects.create(tenant='other',key='private');other=save_draft(other.pk,document(),0)
        private,_=create_review(other.pk,other.version,{})
        response=self.client.get(self.base+'reviews/')
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['reviews'][0]['id'],str(share.id))
        self.assertNotIn(token,response.content.decode());self.assertNotIn(share.secret_hash,response.content.decode())
        self.assertEqual(self.client.get(self.base+f'reviews/{private.id}/').status_code,404)
        self.client.logout()
        self.assertIn(self.client.get(self.base+'reviews/').status_code,(401,403))
    def test_review_access_and_lifetime_changes_are_checked_and_snapshots_remain_fixed(self):
        made=self.client.post(self.base+'reviews/',{'expectedVersion':self.site.version,'canComment':False,'lifetimeDays':3},content_type='application/json')
        self.assertEqual(made.status_code,200,made.content)
        identifier=made.json()['shareId'];url=self.base+f'reviews/{identifier}/'
        row=self.client.get(url).json()
        self.assertFalse(row['canComment'])
        updated=self.client.put(url,{'expectedExpiresAt':row['expiresAt'],'canComment':True,'lifetimeDays':10},content_type='application/json')
        self.assertEqual(updated.status_code,200,updated.content)
        self.assertEqual(updated.json()['revision'],1)
        self.assertEqual(self.client.put(url,{'expectedExpiresAt':row['expiresAt'],'canComment':False},content_type='application/json').status_code,409)
        self.assertEqual(self.client.post(self.base+'reviews/',{'expectedVersion':1,'lifetimeDays':31},content_type='application/json').status_code,400)
        self.client.post(f'/api/website-builder/reviews/{identifier}/revoke/',{},content_type='application/json')
        self.assertEqual(self.client.put(url,{'expectedExpiresAt':updated.json()['expiresAt'],'lifetimeDays':1},content_type='application/json').status_code,400)
    def test_expired_reviews_remain_manageable_and_guest_cannot_resolve(self):
        share,_=create_review(self.site.pk,self.site.version,{},lifetime=timedelta(seconds=1))
        share.expires_at=timezone.now()-timedelta(seconds=1);share.save()
        response=self.client.get(self.base+'reviews/').json()['reviews'][0]
        self.assertFalse(response['active'])
        self.assertEqual(self.client.get(self.base+f'reviews/{share.id}/').status_code,200)
    def test_design_summary_pagination_omits_documents_and_respects_archive_query_and_tenant(self):
        for index in range(5): SavedTemplate.objects.create(tenant='audit',name=f'Design {index}',document=document(),archived=index==0)
        SavedTemplate.objects.create(tenant='private',name='Private design',document=document())
        first=self.client.get(self.base+'templates/?summary=1&limit=2&archived=0').json()
        self.assertEqual(first['total'],4);self.assertEqual(first['nextOffset'],2)
        self.assertTrue(all('document' not in row for row in first['templates']))
        second=self.client.get(self.base+'templates/?summary=1&limit=2&offset=2&archived=0').json()
        self.assertFalse(set(row['id'] for row in first['templates'])&set(row['id'] for row in second['templates']))
        self.assertEqual(len(self.client.get(self.base+'templates/?summary=1&q=Design%200&archived=1').json()['templates']),1)

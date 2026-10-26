from django.test import TestCase
from django.contrib.auth import get_user_model
from website_builder.tests.test_services import document

class WorkspaceTests(TestCase):
    def test_anonymous_cannot_bypass_ui_to_open_demo_or_workspace(self):
        self.assertEqual(self.client.get('/api/demo/bootstrap/').status_code,403)
        self.assertEqual(self.client.get('/api/studio/workspace/').status_code,403)
    def test_local_workspace_initialization_and_analytics_publication(self):
        user=get_user_model().objects.create_user(username='local-owner',is_staff=True)
        self.client.force_login(user)
        r=self.client.post('/api/studio/workspace/open/',{},content_type='application/json')
        self.assertEqual(r.status_code,200,r.content);self.assertIsNone(r.json()['document'])
        setup=self.client.post('/api/studio/workspace/open/',{'document':document()},content_type='application/json').json()
        site=self.client.get('/api/studio/workspace/').json()['sites'][0]
        self.assertEqual(site['id'],setup['id'])
        path=f'/api/studio/workspace/analytics/{site["id"]}/'
        self.assertEqual(self.client.get(path).json()['status'],'Not configured')
        saved=self.client.put(path,{'config':{'provider':'google','domain':'example.com','measurementId':'G-ABCDEFG123'},'expectedVersion':setup['version']},content_type='application/json')
        self.assertEqual(saved.status_code,200,saved.content);self.assertEqual(saved.json()['status'],'Draft configuration')
        live=self.client.post(path,{'action':'publish','expectedVersion':saved.json()['version']},content_type='application/json')
        self.assertEqual(live.status_code,200,live.content);self.assertEqual(live.json()['status'],'Published—verification needed')
        confirmed=self.client.post(path,{'action':'confirm'},content_type='application/json')
        self.assertEqual(confirmed.json()['status'],'User-confirmed verification')
        self.client.logout()
        public=self.client.get('/api/demo/published/')
        self.assertEqual(public.status_code,200,public.content)
        self.assertEqual(public.json()['document']['analytics']['provider'],'google')
    def test_nonstaff_needs_platform_workspace(self):
        user=get_user_model().objects.create_user(username='nonstaff');self.client.force_login(user)
        self.assertEqual(self.client.get('/api/studio/workspace/').status_code,403)
    def test_overview_paging_and_direct_local_website_selection(self):
        from website_builder.models import Website
        from website_builder.services.revisions import save_draft
        user=get_user_model().objects.create_user(username='pagination-owner',is_staff=True)
        self.client.force_login(user)
        for index in range(30):
            site=Website.objects.create(tenant='local-demo',key=f'page-{index}')
            doc=document();doc['title']=f'Page {index}'
            save_draft(site.pk,doc,0)
        page=self.client.get('/api/studio/workspace/?offset=25').json()
        self.assertEqual(page['summary']['websites'],30)
        self.assertEqual(len(page['sites']),5)
        chosen=page['sites'][0]['id']
        opened=self.client.post('/api/studio/workspace/open/',{'websiteId':chosen},content_type='application/json')
        self.assertEqual(opened.status_code,200,opened.content)
        self.assertEqual(opened.json()['id'],chosen)

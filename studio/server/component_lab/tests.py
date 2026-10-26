import copy, io, json, tempfile, zipfile
from pathlib import Path
from urllib.parse import urlsplit
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core import signing
from django.test import TestCase, Client, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import Component, ComponentVersion, Approval
from .imports import manifest, read_upload
from .starter import MANIFEST, HTML, JS
from .views import SALT

def package(files=None, value=None):
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('component.json',json.dumps(value or MANIFEST));z.writestr('index.html',HTML);z.writestr('scene.js',JS)
        for name,content in (files or {}).items(): z.writestr(name,content)
    return SimpleUploadedFile('component.zip',output.getvalue(),content_type='application/zip')

class LabTests(TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory();self.addCleanup(self.directory.cleanup)
        self.config=override_settings(DATA_DIR=Path(self.directory.name));self.config.enable();self.addCleanup(self.config.disable)
        self.owner=get_user_model().objects.create_user(username='studio-owner',password='studio-test-password',is_staff=True)
        self.client.force_login(self.owner)
    def upload(self, value=None):
        response=self.client.post('/api/studio/components/',{'file':package(value=value)})
        self.assertEqual(response.status_code,201,response.content)
        return response.json()['component']
    def approve(self,item,expected=None):
        return self.client.post(f'/api/studio/components/{item["id"]}/approve/',data={'version':item['version'],'expectedApproved':expected},content_type='application/json')
    def test_all_management_routes_require_an_active_administrator(self):
        item=self.upload();self.client.logout()
        for method,path in [('get','/api/studio/components/'),('post','/api/studio/components/'),('get',f'/api/studio/components/{item["id"]}/'),('post',f'/api/studio/components/{item["id"]}/approve/'),('get',f'/api/studio/components/{item["id"]}/export/1/'),('get','/api/studio/starter/')]:
            self.assertEqual(getattr(self.client,method)(path).status_code,403)
        user=get_user_model().objects.create_user(username='member');self.client.force_login(user)
        self.assertEqual(self.client.get('/api/studio/components/').status_code,403)
    def test_csrf_is_required_for_login_and_mutations(self):
        client=Client(enforce_csrf_checks=True)
        self.assertEqual(client.get('/api/studio/session/').status_code,200)
        self.assertEqual(client.post('/api/studio/session/',{'username':'studio-owner','password':'studio-test-password'},content_type='application/json').status_code,403)
        token=client.cookies['studio_csrftoken'].value
        self.assertEqual(client.post('/api/studio/session/',{'username':'studio-owner','password':'studio-test-password'},content_type='application/json',HTTP_X_CSRFTOKEN=token).status_code,200)
        self.assertEqual(client.post('/api/studio/components/',{'file':package()}).status_code,403)
    def test_upload_is_a_draft_until_explicit_approval(self):
        item=self.upload()
        self.assertEqual(item['fileCount'],3);self.assertFalse(item['approved'])
        self.assertEqual(self.client.get('/api/studio/catalog/').json()['components'],[])
        self.assertEqual(self.client.get(f'/api/studio/catalog/{item["id"]}/1/').status_code,404)
        result=self.approve(item);self.assertEqual(result.status_code,200,result.content)
        public=self.client.get('/api/studio/catalog/').json()['components'][0]
        self.assertIn('/components/public/',public['entryUrl']);self.assertTrue(public['approved'])
    def test_runtime_has_expiring_preview_links_cors_and_document_sandbox(self):
        item=self.upload();p=urlsplit(item['entryUrl']).path.replace('/components/','/api/studio/runtime/',1)
        self.client.logout();response=self.client.get(p)
        self.assertEqual(response.status_code,200,response.content)
        csp=response['Content-Security-Policy'];self.assertIn('sandbox allow-scripts;',csp);self.assertNotIn('allow-same-origin',csp)
        self.assertIn("frame-src 'none'",csp);self.assertIn("base-uri 'none'",csp)
        self.assertEqual(response['Access-Control-Allow-Origin'],'*');self.assertEqual(response['Cache-Control'],'no-store')
        self.assertIn(b'component:init',response.content);self.assertIn(b'three@0.180.0',response.content)
        self.assertEqual(self.client.get(p.replace('/index.html','/scene.js')).status_code,200)
        invalid=p.replace(p.split('/')[4],'invalid')
        self.assertEqual(self.client.get(invalid).status_code,403)
        self.assertEqual(self.client.get(f'/api/studio/runtime/public/{item["id"]}/1/index.html').status_code,404)
        with __import__('unittest.mock',fromlist=['patch']).patch('django.core.signing.time.time',return_value=10_000_000_000):
            self.assertEqual(self.client.get(p).status_code,403)
    def test_new_defaults_make_an_immutable_draft_and_rollback_retains_pinned_public_versions(self):
        item=self.upload();self.approve(item)
        m=copy.deepcopy(item['manifest']);m['fields'][0]['default']='#ff0000'
        response=self.client.put(f'/api/studio/components/{item["id"]}/',{'expectedVersion':1,'manifest':m},content_type='application/json')
        self.assertEqual(response.status_code,200,response.content);next_item=response.json()['component']
        self.assertEqual(next_item['version'],2)
        self.assertEqual(self.client.get('/api/studio/catalog/').json()['components'][0]['version'],1)
        self.assertEqual(self.approve(next_item,1).status_code,200)
        self.assertEqual(self.approve(item,2).status_code,200)
        self.assertEqual(self.client.get(f'/api/studio/catalog/{item["id"]}/2/').status_code,200)
        self.assertEqual(self.client.get(f'/api/studio/runtime/public/{item["id"]}/2/scene.js').status_code,200)
        version=ComponentVersion.objects.get(component_id=item['id'],number=1)
        with self.assertRaises(ValueError):version.save()
        self.assertEqual(version.manifest['fields'][0]['default'],'#3d5afe')
    def test_stale_defaults_and_approval_are_conflicts(self):
        item=self.upload()
        self.assertEqual(self.client.put(f'/api/studio/components/{item["id"]}/',{'expectedVersion':0,'manifest':item['manifest']},content_type='application/json').status_code,409)
        self.assertEqual(self.approve(item,3).status_code,409)
        self.assertEqual(ComponentVersion.objects.count(),1)
    def test_export_roundtrips_a_package_without_executing_it(self):
        item=self.upload();response=self.client.get(f'/api/studio/components/{item["id"]}/export/1/')
        parsed,files,native=read_upload(SimpleUploadedFile('export.zip',response.content))
        self.assertEqual(parsed,item['manifest']);self.assertIn('scene.js',files);self.assertIsNone(native)
    def test_missing_refs_traversal_symlinks_and_unexpected_files_are_rejected(self):
        for file in [package({'../escape.js':'x'}),package({'server.py':'print(1)'}),package(value={**MANIFEST,'entry':'missing.html'}),package({'broken.css':'div{background:url(missing.png)}'})]:
            with self.subTest(name=file.name):self.assertEqual(self.client.post('/api/studio/components/',{'file':file}).status_code,400)
        output=io.BytesIO()
        with zipfile.ZipFile(output,'w') as z:
            info=zipfile.ZipInfo('index.html');info.external_attr=(0o120777<<16);z.writestr(info,'target')
        with self.assertRaises(ValidationError):read_upload(SimpleUploadedFile('link.zip',output.getvalue()))
        self.assertEqual(Component.objects.count(),0)
    def test_manifest_rejects_executable_settings_private_inputs_and_unpinned_modules(self):
        cases=[{'dataKeys':['patients']},{'fields':[{'key':'constructor','type':'text'}]},{'imports':{'three':'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js'}},{'networkOrigins':['https://example.com/path']},{'fields':[{'key':'speed','type':'number','min':0,'max':3,'default':4}]},{'entry':'../index.html'}]
        for patch in cases:
            with self.subTest(patch=patch),self.assertRaises(ValidationError):manifest({**MANIFEST,**patch})
    def test_starter_is_a_valid_zip_with_browser_modules(self):
        response=self.client.get('/api/studio/starter/');self.assertEqual(response.status_code,200)
        m,files,_=read_upload(SimpleUploadedFile('starter.zip',response.content));self.assertEqual(m['name'],'Orbit banner');self.assertIn('ComponentLab.onUpdate',files['scene.js'].decode())
    def test_setup_is_unavailable_after_an_administrator_exists(self):
        self.client.logout();self.assertFalse(self.client.get('/api/studio/session/').json()['canEnroll'])
        response=self.client.post('/api/studio/session/',{'enroll':True,'username':'other','password':'long-enough-test-password'},content_type='application/json')
        self.assertEqual(response.status_code,403)
    @override_settings(DEBUG=True)
    def test_first_local_owner_setup_and_signout(self):
        self.client.logout();self.owner.delete()
        self.assertTrue(self.client.get('/api/studio/session/').json()['canEnroll'])
        response=self.client.post('/api/studio/session/',{'enroll':True,'username':'new-owner','password':'long-enough-test-password'},content_type='application/json')
        self.assertEqual(response.status_code,200,response.content);self.assertTrue(response.json()['authenticated'])
        self.assertTrue(get_user_model().objects.get(username='new-owner').is_staff)
        self.assertEqual(self.client.delete('/api/studio/session/').status_code,200)
        self.assertEqual(self.client.get('/api/studio/components/').status_code,403)

    def test_native_json_import_keeps_name_with_context_and_catalog_summaries_stay_small(self):
        from website_builder.tests.test_services import document
        source = document(); source['title']='Existing section'
        response=self.client.post('/api/studio/components/', {'file':SimpleUploadedFile('section.json',json.dumps(source).encode()),'manifest':json.dumps({'schemaVersion':1,'usage':'event'})})
        self.assertEqual(response.status_code,201,response.content)
        item=response.json()['component'];self.assertGreater(item['byteSize'],0);self.assertEqual(item['name'],'Existing section');self.assertEqual(item['manifest']['usage'],'event')
        self.approve(item)
        summary=self.client.get('/api/studio/catalog/').json()['components'][0]
        self.assertIs(summary['native'],True);self.assertEqual(summary['files'],[])
        full=self.client.get(f'/api/studio/catalog/{item["id"]}/1/').json()['component']
        self.assertEqual(full['native']['title'],'Existing section')
    def test_starter_and_preview_bridge_javascript_parse_without_executing_uploads(self):
        import subprocess
        from .runtime import BRIDGE
        for script in [JS,BRIDGE.removeprefix('<script>').removesuffix('</script>')]:
            result=subprocess.run(['node','--check','--input-type=module'],input=script,text=True,capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr)

    def test_oversized_bodies_are_rejected_before_upload_parsing(self):
        response=self.client.post('/api/studio/components/',data=b'',content_type='application/zip',CONTENT_LENGTH='25000000')
        self.assertEqual(response.status_code,413)
        self.assertEqual(Component.objects.count(),0)

from unittest.mock import patch
from django.test import TestCase, override_settings
from django.utils import timezone
from datetime import timedelta
from .models import PlatformIdentity

PLATFORMS={'pixelcore':{'name':'PixelCore','frontendOrigin':'https://platform.example','apiOrigin':'https://api.example','clientSecret':'test-only-secret'}}
@override_settings(STUDIO_PLATFORMS=PLATFORMS)
class PlatformTests(TestCase):
    def begin(self):
        r=self.client.post('/api/studio/connect/begin/',{'platformId':'pixelcore'},content_type='application/json')
        self.assertEqual(r.status_code,200,r.content)
        return r.json()
    def test_wrong_state_does_not_exchange_identity(self):
        self.begin()
        with patch('component_lab.platforms.remote') as remote:
            r=self.client.post('/api/studio/connect/complete/',{'platformId':'pixelcore','state':'bad','code':'test'},content_type='application/json')
            self.assertEqual(r.status_code,403);remote.assert_not_called()
    def test_platform_identity_never_becomes_administrator_and_does_not_copy_email_account(self):
        from django.contrib.auth import get_user_model
        existing=get_user_model().objects.create_user(username='owner',email='same@example.com',is_staff=True)
        begun=self.begin()
        identity={'issuer':'pixelcore','subject':'123','business':{'id':'business-1','name':'Business'},'user':{'displayName':'Platform owner','email':'same@example.com'},'grant':'server-only-grant','expiresAt':(timezone.now()+timedelta(days=1)).isoformat()}
        with patch('component_lab.platforms.remote',return_value=identity):
            result=self.client.post('/api/studio/connect/complete/',{'platformId':'pixelcore','state':begun['state'],'code':'one-use'},content_type='application/json')
        self.assertEqual(result.status_code,200,result.content)
        data=result.json();self.assertTrue(data['authenticated']);self.assertFalse(data['capabilities']['manageComponents'])
        self.assertNotIn('server-only-grant',result.content.decode())
        self.assertNotEqual(PlatformIdentity.objects.get().user_id,existing.pk)
        self.assertEqual(self.client.get('/api/studio/components/').status_code,403)
        self.assertEqual(self.client.get('/api/demo/bootstrap/').status_code,403)
    def test_unknown_platform_and_untrusted_origin_rejected(self):
        self.assertEqual(self.client.post('/api/studio/connect/begin/',{'platformId':'unknown'},content_type='application/json').status_code,403)
        with override_settings(STUDIO_PLATFORMS={'pixelcore':{**PLATFORMS['pixelcore'],'apiOrigin':'http://untrusted.example'}}):
            self.assertEqual(self.client.post('/api/studio/connect/begin/',{'platformId':'pixelcore'},content_type='application/json').status_code,403)

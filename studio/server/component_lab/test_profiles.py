import io
import tempfile
from PIL import Image
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import PlatformIdentity, StudioProfile

class ProfileTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user(username='profile',password='old-long-test-password',is_staff=True)
        self.client.force_login(self.user)
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        config=override_settings(MEDIA_ROOT=self.temp.name);config.enable();self.addCleanup(config.disable)
    def test_profile_save_and_current_password_check_preserve_login(self):
        r=self.client.patch('/api/studio/profile/',{'displayName':'Studio Owner','email':'owner@example.test'},content_type='application/json')
        self.assertEqual(r.status_code,200,r.content);self.assertEqual(r.json()['user']['displayName'],'Studio Owner')
        self.assertEqual(self.client.post('/api/studio/profile/password/',{'currentPassword':'wrong','newPassword':'new-long-test-password'},content_type='application/json').status_code,400)
        self.assertEqual(self.client.post('/api/studio/profile/password/',{'currentPassword':'old-long-test-password','newPassword':'new-long-test-password'},content_type='application/json').status_code,200)
        self.assertTrue(self.client.get('/api/studio/session/').json()['authenticated'])
        self.user.refresh_from_db();self.assertTrue(self.user.check_password('new-long-test-password'))
    def test_platform_profiles_are_authoritative(self):
        PlatformIdentity.objects.create(user=self.user,issuer='pixelcore',subject='123')
        self.assertEqual(self.client.patch('/api/studio/profile/',{'displayName':'Override','email':''},content_type='application/json').status_code,403)
    def test_avatar_reencodes_and_rejects_unsafe_images(self):
        image=io.BytesIO();Image.new('RGB',(400,200),'blue').save(image,format='PNG')
        r=self.client.post('/api/studio/profile/avatar/',{'file':SimpleUploadedFile('avatar.png',image.getvalue(),content_type='image/png')})
        self.assertEqual(r.status_code,200,r.content)
        url=r.json()['user']['avatarUrl'];result=self.client.get(url)
        with Image.open(io.BytesIO(result.content)) as decoded:
            self.assertEqual(decoded.format,'WEBP');self.assertEqual(decoded.size,(256,256))
        for name,data in [('avatar.svg',b'<svg/>'),('bad.png',b'not-an-image'),('big.png',b'x'*2_000_001)]:
            self.assertEqual(self.client.post('/api/studio/profile/avatar/',{'file':SimpleUploadedFile(name,data)}).status_code,400)
        self.assertEqual(self.client.delete('/api/studio/profile/avatar/').status_code,200)
        self.assertEqual(self.client.get(url).status_code,404)
    def test_invalid_email_and_anonymous_writes_are_rejected(self):
        self.assertEqual(self.client.patch('/api/studio/profile/',{'displayName':'Owner','email':'bad'},content_type='application/json').status_code,400)
        self.client.logout()
        self.assertEqual(self.client.get('/api/studio/profile/').status_code,403)

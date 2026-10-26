from django.test import TestCase, Client
from django.contrib.auth import get_user_model

class IdentityTests(TestCase):
    def test_member_identity_is_separate_from_component_administration(self):
        user = get_user_model().objects.create_user(username='member', password='long-test-password')
        self.client.force_login(user)
        data = self.client.get('/api/studio/session/').json()
        self.assertTrue(data['authenticated'])
        self.assertFalse(data['capabilities']['manageComponents'])
        self.assertEqual(self.client.get('/api/studio/components/').status_code, 403)

    def test_studio_cookies_and_session_survive_reload(self):
        get_user_model().objects.create_user(username='owner', password='long-test-password', is_staff=True)
        client = Client(enforce_csrf_checks=True)
        client.get('/api/studio/session/')
        self.assertIn('studio_csrftoken', client.cookies)
        token = client.cookies['studio_csrftoken'].value
        response = client.post('/api/studio/session/', {'username':'owner','password':'long-test-password'}, content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertIn('studio_sessionid', client.cookies)
        for _ in range(3):
            self.assertTrue(client.get('/api/studio/session/').json()['authenticated'])
        self.assertEqual(client.delete('/api/studio/session/').status_code, 403)
        token = client.cookies['studio_csrftoken'].value
        self.assertEqual(client.delete('/api/studio/session/', HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.assertFalse(client.get('/api/studio/session/').json()['authenticated'])
        self.assertFalse(client.get('/api/studio/session/').json()['silentConnectAllowed'])

from django.test import TestCase
from django.core.exceptions import ValidationError
from website_builder.analytics import validate_analytics
class AnalyticsTests(TestCase):
    def test_template_strips_source_analytics_identity(self):
        from website_builder.validation import template_document
        from website_builder.tests.test_services import document
        value=document();value['analytics']={'provider':'google','domain':'example.com','measurementId':'G-ABCDEFG123'}
        self.assertNotIn('analytics',template_document(value))
    def test_structured_provider_config(self):
        config={'provider':'google','domain':'example.com','measurementId':'G-ABCDEFG123'}
        self.assertEqual(validate_analytics(config),config)
        for value in [{**config,'domain':'https://example.com'},{**config,'measurementId':'G-X;alert(1)'},{**config,'script':'bad'},{'provider':'plausible','domain':'example.com','scriptUrl':'https://evil.example/js/x.js'}]:
            with self.subTest(value=value), self.assertRaises(ValidationError):validate_analytics(value)

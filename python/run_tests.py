import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE","website_builder.demo_settings")
import django
django.setup()
from django.core.management import call_command
call_command("test", "website_builder.tests", verbosity=1)

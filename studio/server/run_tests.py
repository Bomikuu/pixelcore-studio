import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'component_lab.settings')
import django
django.setup()
from django.core.management import call_command
call_command('test', 'component_lab', verbosity=1)

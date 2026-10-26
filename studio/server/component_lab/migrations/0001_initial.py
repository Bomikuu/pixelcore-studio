import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name='StudioAccess', fields=[('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')), ('enrolled', models.BooleanField(default=False))]),
        migrations.CreateModel(name='Component', fields=[('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)), ('name', models.CharField(max_length=100)), ('approved_version', models.PositiveIntegerField(null=True)), ('updated_at', models.DateTimeField(auto_now=True)), ('owner', models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=django.db.models.deletion.PROTECT))]),
        migrations.CreateModel(name='ComponentVersion', fields=[('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')), ('number', models.PositiveIntegerField()), ('manifest', models.JSONField()), ('files', models.JSONField(default=dict)), ('native_document', models.JSONField(null=True)), ('storage_key', models.CharField(max_length=64)), ('byte_size', models.PositiveIntegerField(default=0)), ('created_at', models.DateTimeField(auto_now_add=True)), ('component', models.ForeignKey(to='component_lab.component', related_name='versions', on_delete=django.db.models.deletion.CASCADE))], options={'ordering': ['-number'], 'constraints': [models.UniqueConstraint(fields=['component', 'number'], name='studio_component_version_unique')]}),
        migrations.CreateModel(name='Approval', fields=[('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')), ('created_at', models.DateTimeField(auto_now_add=True)), ('version', models.OneToOneField(to='component_lab.componentversion', on_delete=django.db.models.deletion.CASCADE))]),
    ]

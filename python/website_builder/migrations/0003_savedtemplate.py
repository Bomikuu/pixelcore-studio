import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('website_builder', '0002_savedsection')]
    operations = [migrations.CreateModel(
        name='SavedTemplate',
        fields=[
            ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ('tenant', models.CharField(db_index=True, max_length=160)),
            ('name', models.CharField(max_length=100)),
            ('description', models.CharField(blank=True, max_length=300)),
            ('document', models.JSONField()),
            ('created_at', models.DateTimeField(auto_now_add=True)),
        ],
    )]

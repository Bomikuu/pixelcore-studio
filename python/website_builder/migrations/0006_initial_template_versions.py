from django.db import migrations


def seed_versions(apps, schema_editor):
    Template = apps.get_model('website_builder', 'SavedTemplate')
    Version = apps.get_model('website_builder', 'SavedTemplateRevision')
    for row in Template.objects.all().iterator():
        Version.objects.get_or_create(template=row, number=row.version, defaults={
            'name': row.name, 'description': row.description, 'tags': row.tags, 'document': row.document})


class Migration(migrations.Migration):
    dependencies = [('website_builder', '0005_savedsection_archived_savedsection_tags_and_more')]
    operations = [migrations.RunPython(seed_versions, migrations.RunPython.noop)]

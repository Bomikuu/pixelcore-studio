"""Tenant-scoped saved copies. Page revisions never depend on these rows."""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from website_builder.models import Website, SavedTemplate, SavedSection, SavedTemplateRevision
from website_builder.services.revisions import VersionConflict
from website_builder.validation import template_document


def metadata(row, include_content=True):
    result = {'id': str(row.id), 'name': row.name, 'version': row.version,
              'archived': row.archived, 'tags': row.tags, 'updatedAt': row.updated_at.isoformat()}
    if isinstance(row, SavedTemplate):
        result['description'] = row.description
    if include_content:
        result['document' if isinstance(row, SavedTemplate) else 'node'] = row.document if isinstance(row, SavedTemplate) else row.node
    return result


def validate_metadata(value):
    name = value.get('name', '')
    description = value.get('description', '')
    tags = value.get('tags', [])
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
        raise ValidationError('Use a name of 1–100 characters.')
    if not isinstance(description, str) or len(description) > 300:
        raise ValidationError('Keep descriptions within 300 characters.')
    if not isinstance(tags, list) or len(tags) > 10 or any(not isinstance(tag, str) or not 1 <= len(tag.strip()) <= 40 for tag in tags):
        raise ValidationError('Use up to 10 tags, each 1–40 characters.')
    return {'name': name.strip(), 'description': description.strip(), 'tags': list(dict.fromkeys(tag.strip() for tag in tags))}


def snapshot(row):
    SavedTemplateRevision.objects.create(template=row, number=row.version, name=row.name,
        description=row.description, tags=row.tags, document=row.document)


@transaction.atomic
def mutate(site, identifier, value, *, sections=False, delete=False):
    # Same tenant lock order as template creation, including writes from different websites.
    list(Website.objects.select_for_update().filter(tenant=site.tenant).order_by('id').values_list('id', flat=True))
    model = SavedSection if sections else SavedTemplate
    row = get_object_or_404(model.objects.select_for_update(), pk=identifier, tenant=site.tenant)
    expected = value.get('expectedVersion')
    if type(expected) is not int or expected != row.version:
        raise VersionConflict('This saved design changed. Reopen the library and try again.')
    if delete:
        row.delete()
        return {'deleted': True}
    allowed = {'expectedVersion', 'name', 'description', 'tags', 'archived'} | (set() if sections else {'document', 'restoreVersion'})
    if set(value) - allowed:
        raise ValidationError('Unsupported saved design setting.')
    if 'restoreVersion' in value:
        number = value['restoreVersion']
        if type(number) is not int: raise ValidationError('Choose a valid version.')
        old = get_object_or_404(row.revisions, number=number)
        row.name, row.description, row.tags, row.document = old.name, old.description, old.tags, old.document
    else:
        fields = validate_metadata({'name': value.get('name', row.name), 'description': value.get('description', getattr(row, 'description', '')), 'tags': value.get('tags', row.tags)})
        row.name, row.tags = fields['name'], fields['tags']
        if not sections: row.description = fields['description']
        if 'document' in value: row.document = template_document(value['document'])
    if 'archived' in value:
        if type(value['archived']) is not bool: raise ValidationError('Choose archive or restore.')
        row.archived = value['archived']
    row.version += 1
    row.save()
    if not sections: snapshot(row)
    return metadata(row)


def design_page(rows, params, kind):
    from website_builder.services.discovery import window
    summary=params.get('summary')=='1'
    if params.get('archived') in ('0','1'): rows=rows.filter(archived=params['archived']=='1')
    query=str(params.get('q',''))[:100].strip()
    if query:
        from django.db.models import Q
        match=Q(name__icontains=query)|Q(tags__icontains=query)
        if kind=='templates': match|=Q(description__icontains=query)
        rows=rows.filter(match)
    offset,limit=window(params) if summary else (0,100)
    count=rows.count()
    if summary: rows=rows.defer('document' if kind=='templates' else 'node')
    return {kind:[metadata(row,include_content=not summary) for row in rows[offset:offset+limit]],'nextOffset':offset+limit if offset+limit<count else None,'total':count}

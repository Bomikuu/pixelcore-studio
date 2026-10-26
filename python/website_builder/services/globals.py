"""Tenant-scoped linked sections with independent draft/live immutable versions."""
import copy
from django.core.exceptions import ValidationError
from django.db import transaction
from website_builder.models import GlobalSection, GlobalSectionRevision, Website
from website_builder.validation import normalize_global_fonts
from .revisions import VersionConflict


def linked_ids(document):
    result = set()
    def visit(node):
        if node.get('type') == 'global-section':
            result.add(node.get('props', {}).get('sectionId'))
        for child in node.get('children', []): visit(child)
    visit(document)
    return result


def validate_section(node, document):
    if not isinstance(node, dict) or node.get('type') != 'section':
        raise ValidationError('Choose a section to link globally.')
    if linked_ids(node): raise ValidationError('Global sections cannot contain linked sections.')
    wrapper = copy.deepcopy(document)
    wrapper['id'] = 'global-section-validation'
    wrapper['children'] = [node]
    return normalize_global_fonts(wrapper)['children'][0]


def section_payload(section):
    affected = []
    for site in Website.objects.filter(tenant=section.tenant).select_related('draft', 'published'):
        if any(str(section.id) in linked_ids(revision.document) for revision in (site.draft, site.published) if revision):
            affected.append({'id': str(site.id), 'key': site.key, 'title': (site.draft or site.published).document['title']})
    return {'id': str(section.id), 'name': section.name, 'version': section.version,
            'draftVersion': section.draft.number if section.draft_id else None,
            'publishedVersion': section.published.number if section.published_id else None,
            'node': section.draft.node if section.draft_id else None, 'affectedPages': affected}


def valid_name(name):
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
        raise ValidationError('Give the global section a name of 1–100 characters.')
    return name.strip()


@transaction.atomic
def create_section(site, name, node, actor=None):
    if not site.draft_id: raise ValidationError('Save a website draft first.')
    name = valid_name(name)
    node = validate_section(node, site.draft.document)
    list(Website.objects.select_for_update().filter(tenant=site.tenant).order_by('id').values_list('id', flat=True))
    if GlobalSection.objects.filter(tenant=site.tenant).count() >= 100:
        raise ValidationError('The linked section library is full (100 sections).')
    section = GlobalSection.objects.create(tenant=site.tenant, name=name)
    return update_section(section.id, site, node, 0, actor=actor)


@transaction.atomic
def update_section(identifier, site, node, expected_version, *, name=None, actor=None):
    if not isinstance(expected_version, int) or isinstance(expected_version, bool):
        raise ValidationError('Expected version must be an integer.')
    section = GlobalSection.objects.select_for_update().get(pk=identifier, tenant=site.tenant)
    if section.version != expected_version: raise VersionConflict('A newer global section draft exists. Reload before saving.')
    if not site.draft_id: raise ValidationError('Save a website draft first.')
    node = validate_section(node, site.draft.document)
    if name is not None: section.name = valid_name(name)
    section.version += 1
    section.draft = GlobalSectionRevision.objects.create(section=section, number=section.version, node=node, actor=actor if getattr(actor, 'is_authenticated', False) else None)
    section.save(update_fields=['name', 'version', 'draft', 'updated_at'])
    return section


@transaction.atomic
def publish_section(identifier, tenant, expected_version):
    if not isinstance(expected_version, int) or isinstance(expected_version, bool):
        raise ValidationError('Expected version must be an integer.')
    # Serialize against page publication before taking the section lock, including
    # direct service callers that do not use the HTTP host validation wrapper.
    sites = list(Website.objects.select_for_update(of=('self',)).filter(tenant=tenant).select_related('published').order_by('id'))
    section = GlobalSection.objects.select_for_update().get(pk=identifier, tenant=tenant)
    if section.version != expected_version: raise VersionConflict('The global section changed before publication.')
    if not section.draft_id: raise ValidationError('Save a section draft before publishing.')
    section.published = section.draft
    section.save(update_fields=['published', 'updated_at'])
    from django.core.exceptions import PermissionDenied
    for site in sites:
        if site.published_id and str(section.id) in linked_ids(site.published.document):
            try:
                resolved = public_document(tenant, site.published.document)
                from website_builder.validation import validate_content_mode
                validate_content_mode(resolved)
            except PermissionDenied as error:
                raise ValidationError(f'This section cannot be published because an affected page would be unavailable: {error}') from error
    return section


def resolve_global_sections(tenant, document, data, *, stage='published'):
    if stage not in {'draft', 'published'}: raise ValueError('Unsupported global section stage.')
    # New dict and deep copies make review snapshots independent of later changes.
    result = copy.deepcopy(data)
    identifiers = linked_ids(document)
    result['globalSections'] = {}
    for section in GlobalSection.objects.filter(tenant=tenant, id__in=[v for v in identifiers if _uuid(v)]).select_related('draft', 'published'):
        revision = section.draft if stage == 'draft' else section.published
        if revision:
            result['globalSections'][str(section.id)] = {'id': str(section.id), 'name': section.name, 'version': revision.number, 'node': copy.deepcopy(revision.node)}
    return result


def _uuid(value):
    import uuid
    try: uuid.UUID(str(value)); return True
    except (ValueError, TypeError, AttributeError): return False


def public_document(tenant, document):
    """Remove unpublished linked fallbacks from anonymous serialized documents.

    Stored revisions remain immutable. Runtime data still resolves published links,
    but the raw public document must be safe to inspect independently of rendering.
    """
    import uuid
    from django.core.exceptions import PermissionDenied
    result = copy.deepcopy(document)
    references = linked_ids(result)
    published = {
        str(section.id): section.published.node
        for section in GlobalSection.objects.filter(tenant=tenant, id__in=[value for value in references if _uuid(value)], published__isnull=False).select_related('published')
    }
    used = set()
    def reserve(node):
        used.add(node['id'])
        if node.get('type') != 'global-section':
            for child in node.get('children', []): reserve(child)
    reserve(result)
    def reidentify(node, link_id, path='0'):
        node = copy.deepcopy(node)
        counter = 0
        while True:
            identifier = 'global-' + uuid.uuid5(uuid.NAMESPACE_URL, f'{tenant}:{link_id}:{path}:{node["id"]}:{counter}').hex
            if identifier not in used: break
            counter += 1
        used.add(identifier)
        node['id'] = identifier
        node['children'] = [reidentify(child, link_id, f'{path}.{index}') for index, child in enumerate(node.get('children', []))]
        return node
    def visit(node):
        if node.get('type') == 'global-section':
            identifier = node.get('props', {}).get('sectionId')
            if identifier not in published:
                # Never expose the copied draft if publication was withdrawn later.
                raise PermissionDenied('A linked section is no longer published.')
            node['children'] = [reidentify(published[identifier], node['id'])]
        else:
            for child in node.get('children', []): visit(child)
    visit(result)
    if len(used) > 500:
        raise PermissionDenied('Published linked content exceeds the page element limit.')
    return result

import json
from pathlib import Path
from django.conf import settings

def authorize(request,website,action):
    studio_allowed = not getattr(settings,'WEBSITE_BUILDER_STUDIO_AUTH',False) or (getattr(request.user,'is_active',False) and getattr(request.user,'is_staff',False) and not request.session.get('studio_platform'))
    return studio_allowed and settings.DEBUG and request.META.get("REMOTE_ADDR") in {"127.0.0.1","::1"} and website.tenant == "local-demo"

def resolve_data(request,website,review=False):
    with (Path(__file__).resolve().parents[2] / "examples/sample-data.json").open() as stream:
        result = json.load(stream)
    result.setdefault("assets", {}).update(demo_assets(website.tenant))
    return result

def review_data(request,share):
    if share.revision.website.tenant != "local-demo":
        from django.core.exceptions import PermissionDenied
        raise PermissionDenied("This example review is unavailable.")
    return share.data_snapshot

def capabilities(request,website):
    return {"dataSources":data_sources(),"workspace":{"version":1,"mediaUpload":True,"purpose":"storefront","sourceName":"Example workspace","sourceId":"example","pages":[]},"features":["products","services","event","rsvp","wishes"],"sources":[{"value":"identity.name","label":"Business name"},{"value":"identity.description","label":"Business introduction"},{"value":"event.title","label":"Event title"},{"value":"event.date","label":"Event date"},{"value":"event.venue","label":"Venue"}],"brandKit":{"version":1,"colors":{"primary":"#125b50","text":"#19252e","background":"#ffffff"},"headingFont":"Georgia","bodyFont":"Manrope"}}



def data_sources():
    def source(key, label, fields, collection=False):
        return {'id': key, 'label': label, 'kind': 'collection' if collection else 'record',
                'fields': [{'path': path, 'label': title, 'type': type_} for path, title, type_ in fields]}
    fields = [('name', 'Name', 'text'), ('summary', 'Summary', 'text'), ('href', 'Detail link', 'url'), ('assetId', 'Image', 'asset'), ('base_price', 'Price', 'currency')]
    return [source('identity', 'Sample business', [('name', 'Name', 'text'), ('description', 'Description', 'text')]),
            source('event', 'Sample event', [('title', 'Title', 'text'), ('date', 'Date', 'text'), ('venue', 'Venue', 'text')]),
            source('products', 'Sample products', fields, True), source('services', 'Sample services', fields, True),
            source('schedule', 'Sample programme', [('title', 'Title', 'text'), ('time', 'Time', 'text'), ('location', 'Location', 'text')], True)]


def demo_assets(tenant):
    from django.core.files.storage import default_storage
    from website_builder.models import DemoMedia
    return {str(row.id): {'url': default_storage.url(row.name), 'alt': row.alt, 'type': 'image',
        'version': row.name, 'width': row.metadata['width'], 'height': row.metadata['height'],
        'renditions': [{'url': default_storage.url(item['name']), 'width': item['width']} for item in row.metadata.get('renditions', [])]}
        for row in DemoMedia.objects.filter(tenant=tenant)}


def upload_media(request, website, prepared, alt):
    from django.core.files.storage import default_storage
    from website_builder.models import DemoMedia
    from website_builder.services.media import persist_image
    meta = persist_image(prepared, default_storage, 'demo')
    try: row = DemoMedia.objects.create(tenant=website.tenant, name=meta['name'], alt=alt, metadata=meta)
    except Exception:
        for name in [meta['name'], *[r['name'] for r in meta['renditions']]]: default_storage.delete(name)
        raise
    return {'id': str(row.id), **demo_assets(website.tenant)[str(row.id)]}

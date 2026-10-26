"""Authorized callers supply the tenant; queries never choose a tenant."""
from django.db.models import F, Q
from website_builder.models import Website


def window(params, prefix=''):
    def number(key, default, maximum):
        try: return min(maximum, max(0, int(params.get(prefix+key, params.get(prefix+key.capitalize(), default)))))
        except (TypeError, ValueError): return default
    return number('offset', 0, 1_000_000), max(1, number('limit', 25, 50))


def website_page(tenant, params=None):
    params=params or {}
    rows=Website.objects.filter(tenant=tenant).select_related('draft','published')
    query=str(params.get('q',''))[:100].strip()
    if query: rows=rows.filter(Q(draft__document__title__icontains=query)|Q(key__icontains=query))
    changed=Q(draft__isnull=False)&(Q(published__isnull=True)|~Q(draft_id=F('published_id')))
    status=params.get('status')
    if status=='published': rows=rows.filter(published__isnull=False)
    elif status=='drafts': rows=rows.filter(changed)
    sort=params.get('sort','updated')
    rows=rows.order_by('draft__document__title','id') if sort=='title' else rows.order_by('updated_at' if sort=='oldest' else '-updated_at','id')
    offset,limit=window(params)
    total=rows.count()
    sites=[{'id':str(s.id),'title':s.draft.document.get('title','Untitled website') if s.draft_id else 'Untitled website','version':s.version,'published':bool(s.published_id),'unpublishedChanges':bool(s.draft_id and s.draft_id!=s.published_id),'updatedAt':s.updated_at.isoformat(),'pageCount':1,'sourceKey':s.key,'preview':{'colors':s.draft.document.get('theme',{}).get('colors',{}),'structure':[n.get('type','section') for n in s.draft.document.get('children',[])[:4]]} if s.draft_id else None} for s in rows[offset:offset+limit]]
    return {'sites':sites,'page':{'total':total,'offset':offset,'limit':limit,'nextOffset':offset+limit if offset+limit<total else None}}

from django.db.models import Count, F, Max, Q
from website_builder.models import Website

def website_summary(tenant):
    """Counts cover the authorized tenant, independently of the bounded row list."""
    result=Website.objects.filter(tenant=tenant).aggregate(
        site_count=Count('pk'),
        published_count=Count('pk',filter=Q(published__isnull=False)),
        draft_count=Count('pk',filter=Q(draft__isnull=False)&(Q(published__isnull=True)|~Q(draft_id=F('published_id')))),
        latest_update=Max('updated_at'),
    )
    return {'websites':result['site_count'],'published':result['published_count'],'drafts':result['draft_count'],'updatedAt':result['latest_update'].isoformat() if result['latest_update'] else None}

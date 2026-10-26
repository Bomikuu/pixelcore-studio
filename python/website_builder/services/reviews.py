import math
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from website_builder.models import ReviewShare, ReviewThread, ReviewComment
from website_builder.validation import node_ids
from .revisions import active_share

@transaction.atomic
def add_comment(share_id, *, display_name, body, thread_id=None, anchor=None):
    ReviewShare.objects.select_for_update().get(pk=share_id)
    share = active_share(share_id=share_id)
    if not share.can_comment:
        raise PermissionDenied("This link allows viewing only.")
    name = str(display_name).strip()
    text = str(body).strip()
    if not name or len(name) > 80 or not text or len(text) > 4000:
        raise ValidationError("Enter a name of 1–80 characters and a comment of 1–4000 characters.")
    if ReviewComment.objects.filter(thread__share=share, created_at__gt=timezone.now()-timedelta(minutes=1)).count() >= 30:
        raise ValidationError("Too many comments. Try again in a minute.")
    if thread_id:
        thread = ReviewThread.objects.filter(pk=thread_id, share=share).first()
        if not thread:
            raise PermissionDenied("This thread is not available through this review link.")
    else:
        anchor = anchor or {}
        anchors = node_ids(share.revision.document)
        for linked in share.data_snapshot.get('globalSections', {}).values():
            if isinstance(linked, dict) and isinstance(linked.get('node'), dict): anchors |= node_ids(linked['node'])
        for region in share.data_snapshot.get('frame', {}).get('regions', []): anchors |= node_ids(region)
        if anchor.get("nodeId") not in anchors:
            raise ValidationError("Choose an element in this reviewed revision.")
        x, y = anchor.get("x", .5), anchor.get("y", .5)
        if any(not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= 1 for v in [x,y]):
            raise ValidationError("Invalid comment position.")
        viewport = anchor.get("viewport",1100)
        if not isinstance(viewport,int) or not 200 <= viewport <= 4000:
            raise ValidationError("Invalid review viewport.")
        thread = ReviewThread.objects.create(share=share, node_id=anchor["nodeId"], field=str(anchor.get("field", ""))[:80], x=x, y=y, viewport=viewport)
    ReviewComment.objects.create(thread=thread, display_name=name, body=text)
    return thread

def threads_payload(share):
    return [{"id":str(t.id),"nodeId":t.node_id,"field":t.field,"x":t.x,"y":t.y,"viewport":t.viewport,"resolved":t.resolved,"comments":[{"id":str(c.id),"name":c.display_name,"body":c.body,"createdAt":c.created_at.isoformat()} for c in t.comments.all()]} for t in share.threads.prefetch_related("comments").order_by("created_at")]

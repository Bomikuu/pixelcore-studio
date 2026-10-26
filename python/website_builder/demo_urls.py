import json
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import JsonResponse
from django.urls import include,path
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import ensure_csrf_cookie
from website_builder.models import Website
from website_builder.views import endpoint, website_payload
from website_builder.services.revisions import save_draft

@endpoint
@ensure_csrf_cookie
@require_http_methods(["GET","POST"])
def bootstrap(request):
    if getattr(settings,'WEBSITE_BUILDER_STUDIO_AUTH',False) and (not getattr(request.user,'is_active',False) or not getattr(request.user,'is_staff',False) or request.session.get('studio_platform')):
        raise PermissionDenied('Sign in to the local Studio workspace to continue.')
    if not settings.DEBUG or request.META.get("REMOTE_ADDR") not in {"127.0.0.1","::1"}:
        raise PermissionDenied("The example workspace is available on loopback only.")
    site,_ = Website.objects.get_or_create(tenant="local-demo",key="example")
    if request.method == "POST" and not site.draft_id:
        site = save_draft(site.id,request.builder_data["document"],0)
    return JsonResponse(website_payload(request,site))
urlpatterns=[path("api/demo/bootstrap/",bootstrap),path("api/website-builder/",include("website_builder.urls"))]

@endpoint
@require_http_methods(["GET"])
def published(request,website_id=None):
    from django.shortcuts import get_object_or_404
    from website_builder.demo_hooks import resolve_data
    query={'pk':website_id} if website_id else {'key':'example'}
    website=get_object_or_404(Website.objects.select_related("published"),tenant="local-demo",published__isnull=False,**query)
    from website_builder.services.globals import public_document, resolve_global_sections
    document = public_document(website.tenant, website.published.document)
    return JsonResponse({"document":document,"data":resolve_global_sections(website.tenant, document, resolve_data(request,website))})
urlpatterns.append(path("api/demo/published/<uuid:website_id>/",published))
urlpatterns.append(path("api/demo/published/",published))

from django.views.static import serve
def demo_media(request, path):
    return serve(request, path, document_root=settings.MEDIA_ROOT)
urlpatterns.append(path("api/demo/media/<path:path>", demo_media))

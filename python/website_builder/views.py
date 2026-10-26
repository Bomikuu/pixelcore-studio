import json
from functools import wraps
from django.conf import settings
from django.core import signing
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db import transaction
from website_builder.models import Website, ReviewShare
from website_builder.hooks import authorize, resolve_data, review_data, hook, AuthenticationRequired
from website_builder.services.revisions import save_draft, publish, create_review, active_share, VersionConflict
from website_builder.services.reviews import add_comment, threads_payload

COOKIE = "website_review"

def cookie_name(share_id):
    return COOKIE + "_" + str(share_id).replace("-", "")

def review_payload(request, share, data=None):
    can_resolve = False
    try:
        authorize(request,share.revision.website,"resolve")
        can_resolve = True
    except PermissionDenied:
        pass
    return {"id":str(share.id),"revision":share.revision.number,"document":share.revision.document,"data":review_data(request,share) if data is None else data,"canComment":share.can_comment,"canResolve":can_resolve,"threads":threads_payload(share),"expiresAt":share.expires_at.isoformat()}


def endpoint(fn):
    @wraps(fn)
    def wrapped(request,*args,**kwargs):
        try:
            if request.method not in {"GET", "HEAD"} and not (request.content_type == 'multipart/form-data' and fn.__name__ == 'media_library'):
                if len(request.body)>600_000:
                    raise ValidationError("Request is too large.")
                request.builder_data = json.loads(request.body or b"{}")
                if not isinstance(request.builder_data,dict):
                    raise ValidationError("Expected a JSON object.")
            response = fn(request,*args,**kwargs)
        except VersionConflict as error:
            response=JsonResponse({"error":{"code":"CONFLICT","message":str(error)}},status=409)
        except AuthenticationRequired as error:
            response=JsonResponse({"error":{"code":"AUTHENTICATION_REQUIRED","message":str(error)}},status=401)
        except PermissionDenied as error:
            response=JsonResponse({"error":{"code":"FORBIDDEN","message":str(error)}},status=403)
        except (ValidationError, ValueError, TypeError, KeyError) as error:
            response=JsonResponse({"error":{"code":"INVALID_INPUT","message":"; ".join(error.messages) if isinstance(error,ValidationError) else str(error)}},status=400)
        response["Cache-Control"]="no-store, private"
        response["X-Robots-Tag"]="noindex, nofollow"
        response["Referrer-Policy"]="no-referrer"
        return response
    return wrapped

def website_payload(request, site):
    import hashlib
    capabilities = (hook("CAPABILITIES")(request, site) if hook("CAPABILITIES") else {})
    workspace = capabilities.setdefault('workspace', {})
    identity = str(getattr(getattr(request, 'user', None), 'pk', None) or 'local-demo')
    workspace['recoveryScope'] = hashlib.sha256(f'{site.tenant}:{site.id}:{identity}'.encode()).hexdigest()
    return {"id":str(site.id),"version":site.version,"document":site.draft.document if site.draft_id else None,"publishedRevision":str(site.published_id) if site.published_id else None,"data":resolve_data(request,site),"capabilities":capabilities}

@endpoint
@require_http_methods(["GET", "PUT"])
def website(request, website_id):
    site=get_object_or_404(Website.objects.select_related("draft","published"),pk=website_id)
    authorize(request,site,"edit")
    if request.method=="PUT":
        site=save_draft(site.id,request.builder_data["document"],request.builder_data["expectedVersion"],request.user)
    return JsonResponse(website_payload(request,site))

@endpoint
@require_http_methods(["POST"])
@transaction.atomic
def publish_website(request,website_id):
    site=get_object_or_404(Website,pk=website_id);authorize(request,site,"publish")
    resolve_data(request,site)
    site=publish(site.id,request.builder_data["expectedVersion"])
    callback=hook("AFTER_PUBLISH")
    if callback:callback(request,site)
    return JsonResponse({"version":site.version,"publishedRevision":str(site.published_id)})

@endpoint
@require_http_methods(["GET", "POST"])
def make_review(request,website_id):
    site=get_object_or_404(Website,pk=website_id);authorize(request,site,"review")
    if request.method=='GET':
        from website_builder.services.discovery import window
        from django.db.models import Count, Q
        rows=ReviewShare.objects.filter(revision__website=site).select_related('revision').annotate(open_count=Count('threads',filter=Q(threads__resolved=False))).order_by('-created_at','id')
        offset,limit=window(request.GET);total=rows.count()
        return JsonResponse({'reviews':[{'id':str(row.id),'revision':row.revision.number,'canComment':row.can_comment,'expiresAt':row.expires_at.isoformat(),'revoked':bool(row.revoked_at),'active':not row.revoked_at and row.expires_at>timezone.now(),'openCount':row.open_count} for row in rows[offset:offset+limit]],'nextOffset':offset+limit if offset+limit<total else None})
    from datetime import timedelta
    days=request.builder_data.get('lifetimeDays',7)
    if type(days) is not int or not 1<=days<=30: raise ValidationError('Choose a review lifetime of 1–30 days.')
    if type(request.builder_data.get('canComment',True)) is not bool: raise ValidationError('Choose view-only or comments.')
    share,token=create_review(site.id,request.builder_data["expectedVersion"],resolve_data(request,site,review=True),can_comment=request.builder_data.get("canComment",True),lifetime=timedelta(days=days))
    origin=getattr(settings,"WEBSITE_BUILDER_FRONTEND_URL","").rstrip("/")
    path=getattr(settings,"WEBSITE_BUILDER_REVIEW_PATH","/website-review")
    return JsonResponse({"url":f"{origin}{path}?review={share.id}#{token}","shareId":str(share.id),"expiresAt":share.expires_at.isoformat()})

@endpoint
@require_http_methods(["POST"])
def exchange_review(request):
    token=request.builder_data.get("token","")
    if not isinstance(token,str) or len(token)>256:raise PermissionDenied("Invalid review link.")
    share=active_share(token=token);data=review_data(request,share)
    response=JsonResponse(review_payload(request,share,data))
    session=signing.dumps({"share":str(share.id)},salt="website-builder-review-session")
    response.set_cookie(cookie_name(share.id),session,max_age=min(7*86400,int((share.expires_at-timezone.now()).total_seconds())),httponly=True,secure=not settings.DEBUG,samesite="Lax",path="/api/website-builder/reviews/")
    return response

def session_share(request,share_id):
    try:
        payload=signing.loads(request.COOKIES.get(cookie_name(share_id),""),salt="website-builder-review-session",max_age=7*86400)
    except signing.BadSignature as error:
        raise PermissionDenied("Open your review link again.") from error
    if payload.get("share")!=str(share_id):raise PermissionDenied("This session belongs to another review.")
    share=active_share(share_id=share_id);review_data(request,share);return share

@endpoint
@require_http_methods(["GET", "POST"])
def review_comments(request,share_id):
    share=session_share(request,share_id)
    if request.method=="POST":
        payload=request.builder_data
        add_comment(share.id,display_name=payload.get("name",""),body=payload.get("body",""),thread_id=payload.get("threadId"),anchor=payload.get("anchor"))
    return JsonResponse({"threads":threads_payload(share)})

@endpoint
@require_http_methods(["POST"])
def resolve_thread(request,share_id,thread_id):
    share=get_object_or_404(ReviewShare.objects.select_related("revision__website"),pk=share_id)
    authorize(request,share.revision.website,"resolve")
    thread=get_object_or_404(share.threads,pk=thread_id);thread.resolved=bool(request.builder_data.get("resolved",True));thread.save(update_fields=["resolved"])
    return JsonResponse({"threads":threads_payload(share)})

@endpoint
@require_http_methods(["POST"])
def revoke_review(request,share_id):
    share=get_object_or_404(ReviewShare.objects.select_related("revision__website"),pk=share_id);authorize(request,share.revision.website,"review")
    share.revoked_at=timezone.now();share.save(update_fields=["revoked_at"]);return JsonResponse({"revoked":True})

@endpoint
@require_http_methods(["GET"])
def read_review(request,share_id):
    share=session_share(request,share_id)
    return JsonResponse(review_payload(request,share))

@endpoint
@ensure_csrf_cookie
@require_http_methods(["GET"])
def csrf_cookie(request):
    return JsonResponse({"ready":True})


@endpoint
@require_http_methods(["GET", "POST"])
@transaction.atomic
def saved_sections(request, website_id):
    from website_builder.models import SavedSection
    from website_builder.services.library import metadata
    from website_builder.validation import validate_document
    import copy
    site=get_object_or_404(Website.objects.select_related('draft'),pk=website_id)
    authorize(request,site,'edit')
    if request.method=='POST':
        list(Website.objects.select_for_update().filter(tenant=site.tenant).order_by('id').values_list('id', flat=True))
        name=request.builder_data.get('name','')
        node=request.builder_data.get('node')
        if not isinstance(name,str) or not 1<=len(name.strip())<=100 or not isinstance(node,dict) or node.get('type')!='section':
            raise ValidationError('Choose a section and a name of 1–100 characters.')
        if SavedSection.objects.filter(tenant=site.tenant).count()>=100:raise ValidationError('The section library is full (100 sections).')
        if not site.draft_id:raise ValidationError('Save a website draft first.')
        wrapper=copy.deepcopy(site.draft.document);wrapper['id']='saved-section-validation';wrapper['children']=[node]
        validate_document(wrapper)
        SavedSection.objects.create(tenant=site.tenant,name=name.strip(),node=node)
    from website_builder.services.library import design_page
    return JsonResponse(design_page(SavedSection.objects.filter(tenant=site.tenant).order_by('-created_at','id'),request.GET,'sections'))


@endpoint
@require_http_methods(["GET", "POST"])
def saved_templates(request, website_id):
    from website_builder.models import SavedTemplate
    from website_builder.validation import template_document
    site = get_object_or_404(Website, pk=website_id)
    authorize(request, site, 'edit')
    from website_builder.services.library import metadata as payload, snapshot, validate_metadata
    result = {}
    if request.method == 'POST':
        name = request.builder_data.get('name', '')
        description = request.builder_data.get('description', '')
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
            raise ValidationError('Give your template a name of 1–100 characters.')
        if not isinstance(description, str) or len(description) > 300:
            raise ValidationError('Keep the template description within 300 characters.')
        document = template_document(request.builder_data.get('document'))
        # Serialize library writes within a tenant, including requests from different pages.
        with transaction.atomic():
            list(Website.objects.select_for_update().filter(tenant=site.tenant).order_by('id').values_list('id', flat=True))
            if SavedTemplate.objects.filter(tenant=site.tenant).count() >= 100:
                raise ValidationError('The template library is full (100 templates).')
            created = SavedTemplate.objects.create(tenant=site.tenant, name=name.strip(), description=description.strip(), document=document)
            created.tags = validate_metadata(request.builder_data)['tags']
            created.save(update_fields=['tags'])
            snapshot(created)
            result['template'] = payload(created)
    from website_builder.services.library import design_page
    result.update(design_page(SavedTemplate.objects.filter(tenant=site.tenant).order_by('-created_at','id'),request.GET,'templates'))
    return JsonResponse(result)


def revision_payload(site, revision, *, include_document=False):
    result = {'id': str(revision.id), 'number': revision.number, 'createdAt': revision.created_at.isoformat(),
              'isDraft': site.draft_id == revision.id, 'isPublished': site.published_id == revision.id,
              'title': revision.document.get('title', '')}
    if include_document: result['document'] = revision.document
    return result


@endpoint
@require_http_methods(['GET'])
def revisions(request, website_id):
    site = get_object_or_404(Website, pk=website_id)
    authorize(request, site, 'edit')
    return JsonResponse({'revisions': [revision_payload(site, revision) for revision in site.revisions.order_by('-number')[:100]]})


@endpoint
@require_http_methods(['GET'])
def read_revision(request, website_id, revision_id):
    site = get_object_or_404(Website, pk=website_id)
    authorize(request, site, 'edit')
    revision = get_object_or_404(site.revisions, pk=revision_id)
    return JsonResponse({'revision': revision_payload(site, revision, include_document=True)})


@endpoint
@require_http_methods(['POST'])
def restore_revision(request, website_id, revision_id):
    from website_builder.services.revisions import restore_revision as restore
    site = get_object_or_404(Website, pk=website_id)
    authorize(request, site, 'edit')
    get_object_or_404(site.revisions, pk=revision_id)
    site = restore(site.id, revision_id, request.builder_data['expectedVersion'], request.user)
    return JsonResponse(website_payload(request, site))


@endpoint
@require_http_methods(['GET', 'POST'])
def global_sections(request, website_id):
    from website_builder.models import GlobalSection
    from website_builder.services.globals import create_section, section_payload
    site = get_object_or_404(Website.objects.select_related('draft'), pk=website_id)
    authorize(request, site, 'edit')
    result = {}
    if request.method == 'POST':
        section = create_section(site, request.builder_data.get('name'), request.builder_data.get('node'), request.user)
        result['section'] = section_payload(section)
    result['sections'] = [section_payload(section) for section in GlobalSection.objects.filter(tenant=site.tenant).select_related('draft', 'published').order_by('-updated_at')[:100]]
    return JsonResponse(result)


@endpoint
@require_http_methods(['GET', 'PUT'])
def global_section(request, website_id, section_id):
    from website_builder.models import GlobalSection
    from website_builder.services.globals import update_section, section_payload
    site = get_object_or_404(Website.objects.select_related('draft'), pk=website_id)
    authorize(request, site, 'edit')
    section = get_object_or_404(GlobalSection.objects.select_related('draft', 'published'), pk=section_id, tenant=site.tenant)
    if request.method == 'PUT':
        section = update_section(section.id, site, request.builder_data.get('node'), request.builder_data.get('expectedVersion'), name=request.builder_data.get('name'), actor=request.user)
    return JsonResponse({'section': section_payload(section)})


@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def publish_global_section(request, website_id, section_id):
    from website_builder.models import GlobalSection
    from website_builder.services.globals import publish_section, section_payload
    site = get_object_or_404(Website.objects.select_related('draft'), pk=website_id)
    authorize(request, site, 'publish')
    get_object_or_404(GlobalSection, pk=section_id, tenant=site.tenant)
    # Match page publication's website-first lock order, and freeze the affected live set.
    # Otherwise a page can acquire this link while the global host validation scans pages.
    list(Website.objects.select_for_update().filter(tenant=site.tenant).order_by('id').values_list('id', flat=True))
    section = publish_section(section_id, site.tenant, request.builder_data.get('expectedVersion'))
    # Revalidate every referencing live page against the host's public-safe sources.
    callback = hook('VALIDATE_GLOBAL_PUBLISH')
    if callback: callback(request, site, section)
    return JsonResponse({'section': section_payload(section)})


@endpoint
@require_http_methods(['GET', 'PUT', 'DELETE'])
def saved_design(request, website_id, design_id, sections=False):
    from website_builder.models import SavedTemplate, SavedSection
    from website_builder.services.library import metadata, mutate
    site = get_object_or_404(Website, pk=website_id)
    authorize(request, site, 'edit')
    if request.method != 'GET':
        result = mutate(site, design_id, request.builder_data, sections=sections, delete=request.method == 'DELETE')
        return JsonResponse({'design': result})
    row = get_object_or_404(SavedSection if sections else SavedTemplate, pk=design_id, tenant=site.tenant)
    result = metadata(row)
    if not sections:
        result['revisions'] = [{'number': r.number, 'name': r.name, 'createdAt': r.created_at.isoformat()} for r in row.revisions.order_by('-number')[:100]]
    return JsonResponse({'design': result})


@endpoint
@require_http_methods(['GET'])
def saved_template_version(request, website_id, design_id, number):
    from website_builder.models import SavedTemplate
    site = get_object_or_404(Website, pk=website_id)
    authorize(request, site, 'edit')
    row = get_object_or_404(SavedTemplate, pk=design_id, tenant=site.tenant)
    revision = get_object_or_404(row.revisions, number=number)
    return JsonResponse({'template': {'name': revision.name, 'description': revision.description, 'document': revision.document}})


@endpoint
@require_http_methods(['POST'])
def media_library(request, website_id):
    from website_builder.services.media import prepare_image
    site = get_object_or_404(Website, pk=website_id)
    authorize(request, site, 'edit')
    callback = hook('UPLOAD_MEDIA')
    if not callback: raise ValidationError('This project has not connected image uploads. Use its media library.')
    alt = request.POST.get('alt', '')
    if not isinstance(alt, str) or len(alt) > 250: raise ValidationError('Keep alt text within 250 characters.')
    upload = request.FILES.get('file')
    prepared = prepare_image(upload)
    result = callback(request, site, prepared, alt.strip())
    return JsonResponse({'asset': result})


@endpoint
@require_http_methods(['GET','PUT'])
def manage_review(request,website_id,share_id):
    from datetime import timedelta
    site=get_object_or_404(Website,pk=website_id)
    authorize(request,site,'review')
    with transaction.atomic():
        share=get_object_or_404(ReviewShare.objects.select_for_update().select_related('revision__website'),pk=share_id,revision__website=site)
        if request.method=='PUT':
            value=request.builder_data
            if share.revoked_at: raise ValidationError('Revoked links cannot be reactivated. Create a new review.')
            if value.get('expectedExpiresAt')!=share.expires_at.isoformat(): raise VersionConflict('This link changed. Reload its settings.')
            if 'canComment' in value:
                if type(value['canComment']) is not bool: raise ValidationError('Choose view-only or comments.')
                share.can_comment=value['canComment']
            if 'lifetimeDays' in value:
                days=value['lifetimeDays']
                if type(days) is not int or not 1<=days<=30: raise ValidationError('Choose 1–30 days.')
                share.expires_at=timezone.now()+timedelta(days=days)
            share.save(update_fields=['can_comment','expires_at'])
        return JsonResponse({'id':str(share.id),'revision':share.revision.number,'canComment':share.can_comment,'expiresAt':share.expires_at.isoformat(),'revoked':bool(share.revoked_at),'threads':threads_payload(share)})

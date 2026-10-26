import base64
import json
from django.core.exceptions import PermissionDenied
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from website_builder.models import Website
from website_builder.services.workspace import website_summary
from .identity import authenticated
from .platforms import gateway
from .views import api, body

def local(request):
    user=authenticated(request)
    if not user.is_staff: raise PermissionDenied('Connect an authorized platform business to start editing.')

@api
@require_http_methods(['GET'])
def overview(request):
    authenticated(request)
    if request.session.get('studio_platform'): return JsonResponse(gateway(request,'overview',request.GET.dict()))
    local(request)
    from website_builder.services.discovery import website_page
    discovered=website_page('local-demo',request.GET)
    for row in discovered['sites']:
        if row['published']: row['publicUrl']='/published'
    return JsonResponse({'workspace':{'id':'local-demo','name':'Example workspace','source':'studio','sample':True},**discovered,'summary':website_summary('local-demo'),'sources':[],'sourcePage':{'total':0,'offset':0,'limit':25,'nextOffset':None},'capabilities':{'editWebsite':True,'manageComponents':True}})


@api
@require_http_methods(['POST'])
def open_website(request):
    authenticated(request)
    value=body(request)
    if request.session.get('studio_platform'):
        result=gateway(request,'builder',{'route':f"sites/{value['websiteId']}/",'method':'GET'}) if value.get('websiteId') else gateway(request,'open',value)
        result['transportBase']='/api/studio/workspace/builder/'
        return JsonResponse(result)
    local(request)
    from website_builder.views import website_payload
    from website_builder.services.revisions import save_draft
    if value.get('websiteId'):
        from django.shortcuts import get_object_or_404
        site=get_object_or_404(Website,pk=value['websiteId'],tenant='local-demo')
    else: site,_=Website.objects.get_or_create(tenant='local-demo',key='example')
    if not site.draft_id and value.get('document'):
        site=save_draft(site.pk,value['document'],0,request.user)
    return JsonResponse(website_payload(request,site))

@api
@require_http_methods(['GET','POST','PUT','DELETE'])
def builder(request, route):
    authenticated(request)
    if not request.session.get('studio_platform'): raise PermissionDenied('A platform workspace is required.')
    args={'route':route,'method':request.method,'query':request.GET.dict()}
    if request.content_type=='multipart/form-data':
        file=request.FILES.get('file')
        if not file or file.size>20_000_000: raise PermissionDenied('Upload a media file under 20 MB.')
        args['file']={'data':base64.b64encode(file.read()).decode(),'name':file.name,'type':file.content_type}
        args['alt']=request.POST.get('alt','')
    elif request.method!='GET':
        if len(request.body)>600_000: raise PermissionDenied('The request is too large.')
        args['body']=json.loads(request.body or '{}')
    return JsonResponse(gateway(request,'builder',args))

@api
@require_http_methods(['GET','PUT','POST'])
def analytics(request, website_id):
    authenticated(request)
    args={'websiteId':str(website_id),'method':request.method,**(body(request) if request.method!='GET' else {})}
    if request.session.get('studio_platform'): return JsonResponse(gateway(request,'analytics',args))
    local(request)
    from website_builder.analytics import analytics_operation
    return JsonResponse(analytics_operation(request.user,'local-demo',args))

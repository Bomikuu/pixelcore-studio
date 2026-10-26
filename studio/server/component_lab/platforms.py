import json
import secrets
import time
from urllib.parse import urlsplit, urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.http import require_http_methods
from .models import PlatformIdentity, PlatformConnection
from .views import api, body
from .errors import PlatformResponseError

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None

def config(platform):
    value=settings.STUDIO_PLATFORMS.get(platform)
    if not value: raise PermissionDenied('This platform connection is unavailable.')
    for key in ('frontendOrigin','apiOrigin'):
        u=urlsplit(value[key])
        if u.username or u.password or u.path not in ('','/') or u.query or u.fragment or (u.scheme!='https' and not (settings.DEBUG and u.scheme=='http' and u.hostname in {'localhost','127.0.0.1'})):
            raise PermissionDenied('Configure a trusted HTTPS platform origin.')
    return value

def remote(platform, endpoint, payload):
    c=config(platform)
    req=Request(c['apiOrigin'].rstrip('/')+'/api/studio-bridge/'+endpoint+'/',json.dumps(payload).encode(),headers={'Content-Type':'application/json','X-Studio-Client':c['clientSecret']},method='POST')
    try:
        with build_opener(NoRedirect()).open(req,timeout=15) as response:
            raw=response.read(28_000_001)
            if len(raw)>28_000_000: raise ValidationError('The platform response is too large.')
            return json.loads(raw)
    except HTTPError as error:
        if error.code in {401,403}: raise PlatformResponseError(403,{'error':{'code':'RECONNECT_REQUIRED','message':'Reconnect your platform; the session expired or access changed.'}}) from error
        try: value=json.loads(error.read(100_000))
        except (ValueError,OSError): value={'error':{'message':'The platform could not complete this operation. Try again.'}}
        raise PlatformResponseError(error.code if error.code in {400,404,405,409,413} else 502,value) from error
    except (URLError, TimeoutError, OSError) as error:
        raise ValidationError('The platform cannot be reached. Your work stays in its workspace. Try again.') from error

def connection(request):
    from .identity import authenticated
    authenticated(request)
    value=PlatformConnection.objects.filter(session_key=request.session.session_key,platform=request.session.get('studio_platform'),expires_at__gt=timezone.now()).first()
    if not value: raise PermissionDenied('Reconnect your platform to continue.')
    return value

def gateway(request, operation, args=None):
    value=connection(request)
    return remote(value.platform,'gateway',{'grant':value.grant,'operation':operation,'args':args or {}})

def revoke_connection(request):
    values=PlatformConnection.objects.filter(session_key=request.session.session_key)
    for value in values:
        try: remote(value.platform,'gateway',{'grant':value.grant,'operation':'revoke'})
        except (PermissionDenied,ValidationError,PlatformResponseError): pass
    values.delete()

@api
@require_http_methods(['POST'])
def begin(request):
    value=body(request)
    platform=value.get('platformId')
    c=config(platform)
    state=secrets.token_urlsafe(32)
    request.session['studio_connect']={'state':state,'platform':platform,'expires':time.time()+60}
    audience=settings.WEBSITE_BUILDER_FRONTEND_URL.rstrip('/')
    return JsonResponse({'state':state,'frameUrl':c['frontendOrigin'].rstrip('/')+'/studio-connect?'+urlencode({'state':state,'audience':audience}),'expiresAt':time.time()+60})

@api
@require_http_methods(['POST'])
def complete(request):
    from .identity import session_payload
    value=body(request)
    pending=request.session.pop('studio_connect',None)
    if not pending or pending['expires']<time.time() or not secrets.compare_digest(pending['state'],str(value.get('state',''))) or pending['platform']!=value.get('platformId'):
        raise PermissionDenied('This connection expired. Choose Connect to try again.')
    result=remote(pending['platform'],'exchange',{'code':value.get('code'),'state':pending['state'],'audience':settings.WEBSITE_BUILDER_FRONTEND_URL.rstrip('/')})
    expires=parse_datetime(result.get('expiresAt','')) if isinstance(result,dict) and isinstance(result.get('expiresAt'),str) else None
    if not isinstance(result,dict) or result.get('issuer')!=pending['platform'] or not isinstance(result.get('subject'),str) or not 1<=len(result['subject'])<=100 or not isinstance(result.get('grant'),str) or not 16<=len(result['grant'])<=128 or not expires or not timezone.is_aware(expires) or expires<=timezone.now() or not isinstance(result.get('business'),dict) or not isinstance(result['business'].get('id'),str) or not isinstance(result.get('user'),dict): raise PermissionDenied('The platform returned an invalid identity.')
    mapping=PlatformIdentity.objects.filter(issuer=pending['platform'],subject=result['subject']).select_related('user').first()
    if not mapping:
        user=get_user_model().objects.create_user(username='platform-'+secrets.token_hex(16))
        mapping=PlatformIdentity.objects.create(user=user,issuer=pending['platform'],subject=result['subject'])
    if not mapping.user.is_active: raise PermissionDenied('This Studio identity is inactive.')
    revoke_connection(request)
    login(request,mapping.user,backend='django.contrib.auth.backends.ModelBackend')
    request.session['studio_platform']=pending['platform']
    request.session['studio_workspace']=result['business']
    request.session['studio_user']=result['user']
    request.session.pop('studio_signed_out',None)
    request.session.save()
    PlatformConnection.objects.update_or_create(session_key=request.session.session_key,defaults={'platform':pending['platform'],'grant':result['grant'],'business_id':result['business']['id'],'expires_at':expires})
    return JsonResponse(session_payload(request))

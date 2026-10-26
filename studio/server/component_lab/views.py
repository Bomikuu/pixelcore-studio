import functools, io, json, mimetypes, re, secrets, shutil, zipfile
from pathlib import Path
from urllib.parse import quote
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Max
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from .models import Component, ComponentVersion, Approval, StudioAccess
from .imports import read_upload, manifest, path as safe_path, TYPES
from .errors import PlatformResponseError
from website_builder.services.revisions import VersionConflict

SALT = 'component-lab-preview-v1'
def api(fn):
    @functools.wraps(fn)
    def wrapped(request, *args, **kwargs):
        try: response = fn(request, *args, **kwargs)
        except PlatformResponseError as error: response = JsonResponse(error.value,status=error.status)
        except VersionConflict as error: response = JsonResponse({'error':{'code':'CONFLICT','message':str(error)}},status=409)
        except PermissionDenied as error: response = JsonResponse({'error': {'message': str(error)}}, status=403)
        except (ValidationError, ValueError, TypeError, KeyError, UnicodeError, RecursionError) as error: response = JsonResponse({'error': {'message': '; '.join(error.messages) if isinstance(error, ValidationError) else str(error)}}, status=400)
        response['Cache-Control'] = 'no-store, private'
        response['X-Robots-Tag'] = 'noindex, nofollow'
        response['Referrer-Policy'] = 'no-referrer'
        return response
    return wrapped

def admin(request):
    if not request.user.is_authenticated or not request.user.is_active or not request.user.is_staff: raise PermissionDenied('Sign in with a Studio administrator account.')
def body(request):
    if len(request.body) > 100_000: raise ValidationError('Settings are too large.')
    value = json.loads(request.body or '{}')
    if not isinstance(value, dict): raise ValidationError('Expected settings as a JSON object.')
    return value

def session_data(request):
    from .identity import session_payload
    return session_payload(request)

@api
@ensure_csrf_cookie
@require_http_methods(['GET', 'POST', 'DELETE'])
def session(request):
    if request.method == 'DELETE':
        from .platforms import revoke_connection
        revoke_connection(request)
        logout(request)
        request.session['studio_signed_out'] = True
    if request.method == 'POST':
        value = body(request)
        username = value.get('username', '')
        password = value.get('password', '')
        if not isinstance(username, str) or not re.fullmatch(r'[\w.@+-]{1,80}', username) or not isinstance(password, str) or len(password) > 200: raise ValidationError('Enter a valid account name and password.')
        if value.get('enroll'):
            if not session_data(request)['canEnroll'] or request.META.get('REMOTE_ADDR') not in {'127.0.0.1', '::1'}: raise PermissionDenied('Local administrator setup is unavailable. Ask the Studio administrator for access.')
            validate_password(password)
            with transaction.atomic():
                access, _ = StudioAccess.objects.get_or_create(pk=1)
                if not StudioAccess.objects.filter(pk=access.pk, enrolled=False).update(enrolled=True): raise PermissionDenied('Studio access has already been configured.')
                user = get_user_model().objects.create_user(username=username, password=password, is_staff=True)
        else:
            # A session-local limit plus the deployment's normal rate limiter protects sign-in.
            attempts = request.session.get('studio_login_attempts', 0)
            if attempts >= 10: raise PermissionDenied('Too many sign-in attempts. Ask the administrator to reset this session.')
            user = authenticate(request, username=username, password=password)
            if not user or not user.is_active:
                request.session['studio_login_attempts'] = attempts + 1
                raise PermissionDenied('The account name or password is incorrect.')
        request.session.pop('studio_login_attempts', None)
        request.session.pop('studio_connect', None)
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        request.session.pop('studio_signed_out', None)
        request.session.set_expiry(settings.SESSION_COOKIE_AGE)
    return JsonResponse(session_data(request))

def ticket(version):
    return signing.dumps({'id': str(version.component_id), 'version': version.number}, salt=SALT, compress=True)

def payload(version, private=False, summary=False):
    component = version.component
    m = version.manifest
    key = ticket(version) if private else 'public'
    base = f'{settings.COMPONENT_LAB_ORIGIN}/components/{key}/{component.id}/{version.number}/'
    return {'id': str(component.id), 'version': version.number, 'name': m['name'], 'manifest': m, 'native': bool(version.native_document) if summary else version.native_document, 'entryUrl': base + quote(m['entry']), 'posterUrl': base + quote(m['poster']) if m['poster'] else '', 'approved': Approval.objects.filter(version=version).exists(), 'currentApproved': component.approved_version, 'byteSize': version.byte_size, 'fileCount': len(version.files), 'files': [] if summary else list(version.files), 'createdAt': version.created_at.isoformat()}

def store(component, m, files, native, key=None, byte_size=0, file_sizes=None):
    if files and sum(row['size'] for row in ComponentVersion.objects.values('storage_key').annotate(size=Max('byte_size'))) + sum(map(len, files.values())) > 500_000_000: raise ValidationError('Studio media has reached its 500 MB storage limit. Export unused components before changing the configured storage budget.')
    number = (component.versions.first().number if component.versions.exists() else 0) + 1
    if number > 100: raise ValidationError('This component has reached its 100-version limit.')
    key = key or secrets.token_hex(24)
    root = settings.DATA_DIR / 'component-lab' / key
    created = False
    try:
        if files:
            root.mkdir(parents=True, exist_ok=False)
            created = True
            for name, content in files.items():
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(content)
        v = ComponentVersion.objects.create(component=component, number=number, manifest=m, files={name: len(content) for name, content in files.items()} if created else (file_sizes or {}), native_document=native, storage_key=key, byte_size=byte_size or sum(map(len, files.values())) or (len(json.dumps(native).encode()) if native else 0))
        component.name = m['name']; component.save(update_fields=['name', 'updated_at'])
        return v
    except Exception:
        if created: shutil.rmtree(root, ignore_errors=True)
        raise

@api
@require_http_methods(['GET', 'POST'])
def components(request):
    admin(request)
    if request.method == 'GET':
        items = [payload(c.versions.first(), True, True) for c in Component.objects.order_by('-updated_at')[:200] if c.versions.exists()]
        return JsonResponse({'components': items})
    if Component.objects.count() >= 200: raise ValidationError('The library has reached its 200-component limit.')
    upload = request.FILES.get('file')
    if not upload: raise ValidationError('Choose a ZIP package or builder JSON file.')
    supplied = json.loads(request.POST['manifest']) if request.POST.get('manifest') else None
    m, files, native = read_upload(upload, supplied)
    with transaction.atomic():
        component = Component.objects.create(owner=request.user, name=m['name'])
        result = store(component, m, files, native)
    return JsonResponse({'component': payload(result, True)}, status=201)

@api
@require_http_methods(['GET', 'PUT', 'POST'])
def detail(request, component_id):
    admin(request)
    component = get_object_or_404(Component, pk=component_id)
    if request.method == 'GET': return JsonResponse({'versions': [payload(v, True) for v in component.versions.all()]})
    with transaction.atomic():
        component = Component.objects.select_for_update().get(pk=component_id)
        latest = component.versions.first()
        if request.method == 'POST':
            upload = request.FILES.get('file')
            if not upload: raise ValidationError('Choose a new package version.')
            if int(request.POST.get('expectedVersion', -1)) != latest.number: return JsonResponse({'error': {'message': 'A newer version exists. Refresh the component before uploading.'}}, status=409)
            m, files, native = read_upload(upload)
            v = store(component, m, files, native)
        else:
            value = body(request)
            if value.get('expectedVersion') != latest.number: return JsonResponse({'error': {'message': 'A newer version exists. Refresh before saving.'}}, status=409)
            m = manifest(value['manifest'])
            for target in m['imports'].values():
                if not target.startswith('https:') and target.removeprefix('./') not in latest.files and not latest.native_document: raise ValidationError('A module import file is missing.')
            if not latest.native_document and (m['entry'] not in latest.files or m['poster'] and m['poster'] not in latest.files): raise ValidationError('The entry or poster file is missing from this version.')
            v = store(component, m, {}, latest.native_document, latest.storage_key, latest.byte_size, latest.files)
    return JsonResponse({'component': payload(v, True)})

@api
@require_http_methods(['POST'])
def approve(request, component_id):
    admin(request)
    value = body(request)
    with transaction.atomic():
        component = get_object_or_404(Component.objects.select_for_update(), pk=component_id)
        if value.get('expectedApproved') != component.approved_version: return JsonResponse({'error': {'message': 'The catalog version changed. Refresh before approving.'}}, status=409)
        version = get_object_or_404(ComponentVersion, component=component, number=value.get('version'))
        Approval.objects.get_or_create(version=version)
        component.approved_version = version.number; component.save(update_fields=['approved_version', 'updated_at'])
    return JsonResponse({'component': payload(version, True)})

@require_http_methods(['GET'])
def catalog(request):
    response = JsonResponse({'schemaVersion': 1, 'components': [payload(c.versions.get(number=c.approved_version), summary=True) for c in Component.objects.exclude(approved_version=None).order_by('name')[:200]]})
    response['Access-Control-Allow-Origin'] = '*'
    response['Cache-Control'] = 'public, max-age=60'
    response['X-Content-Type-Options'] = 'nosniff'
    return response

@api
@require_http_methods(['GET'])
def export(request, component_id, number):
    admin(request)
    v = get_object_or_404(ComponentVersion, component_id=component_id, number=number)
    if v.native_document:
        response = JsonResponse(v.native_document)
        response['Content-Disposition'] = 'attachment; filename="component.json"'
        return response
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('component.json', json.dumps(v.manifest, indent=2))
        for name in v.files:
            if name != 'component.json': archive.writestr(name, (settings.DATA_DIR / 'component-lab' / v.storage_key / name).read_bytes())
    response = HttpResponse(output.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = 'attachment; filename="component.zip"'
    return response

@require_http_methods(['GET'])
def catalog_version(request, component_id, number):
    version = get_object_or_404(ComponentVersion, component_id=component_id, number=number, approval__isnull=False)
    response = JsonResponse({'schemaVersion': 1, 'component': payload(version)})
    response['Access-Control-Allow-Origin'] = '*'
    response['Cache-Control'] = 'public, max-age=60'
    response['X-Content-Type-Options'] = 'nosniff'
    return response

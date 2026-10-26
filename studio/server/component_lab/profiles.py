import io
import re
import secrets
import warnings
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError
from django.conf import settings
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.validators import validate_email
from django.http import JsonResponse, HttpResponse, Http404
from django.db import transaction
from django.views.decorators.http import require_http_methods
from .identity import authenticated, session_payload
from .models import StudioProfile
from .views import api, body

def editable(request):
    user=authenticated(request)
    if hasattr(user,'platform_identity'): raise PermissionDenied('Manage this identity in your platform account settings.')
    return user

def directory():
    target=Path(settings.MEDIA_ROOT)/'studio-avatars'
    target.mkdir(parents=True,exist_ok=True)
    return target

@api
@require_http_methods(['GET','PATCH'])
def profile(request):
    authenticated(request)
    if request.method=='PATCH':
        user=editable(request)
        value=body(request)
        name=value.get('displayName','')
        email=value.get('email','')
        if not isinstance(name,str) or len(name.strip())>100 or not name.strip(): raise ValidationError('Enter a display name under 100 characters.')
        if not isinstance(email,str) or len(email)>254: raise ValidationError('Enter a valid email address.')
        if email: validate_email(email)
        with transaction.atomic():
            record,_=StudioProfile.objects.get_or_create(user=user)
            record.display_name=name.strip();record.save(update_fields=['display_name'])
            user.email=email.strip();user.save(update_fields=['email'])
    return JsonResponse(session_payload(request))

@api
@require_http_methods(['POST','DELETE'])
def avatar(request):
    user=editable(request)
    key=''
    if request.method=='POST':
        upload=request.FILES.get('file')
        if not upload or upload.size>2_000_000: raise ValidationError('Choose a JPEG, PNG or WebP image under 2 MB.')
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error',Image.DecompressionBombWarning)
                with Image.open(upload) as image:
                    if image.format not in {'JPEG','PNG','WEBP'} or getattr(image,'n_frames',1)!=1 or max(image.size)>4096: raise ValidationError('Use a still JPEG, PNG or WebP image up to 4096 × 4096 pixels.')
                    image.load()
                    clean=ImageOps.fit(ImageOps.exif_transpose(image).convert('RGB'),(256,256))
                    output=io.BytesIO();clean.save(output,format='WEBP',quality=85)
                    key=secrets.token_hex(24)
                    (directory()/(key+'.webp')).write_bytes(output.getvalue())
        except (UnidentifiedImageError,OSError,Image.DecompressionBombError,Image.DecompressionBombWarning) as error:
            raise ValidationError('This image could not be read. Choose a different image.') from error
    with transaction.atomic():
        record,_=StudioProfile.objects.select_for_update().get_or_create(user=user)
        old=record.avatar_key
        record.avatar_key=key;record.save(update_fields=['avatar_key'])
        if old: transaction.on_commit(lambda:(directory()/(old+'.webp')).unlink(missing_ok=True))
    return JsonResponse(session_payload(request))

@require_http_methods(['GET'])
def image(request,key):
    if not re.fullmatch(r'[a-f0-9]{48}',key) or not StudioProfile.objects.filter(avatar_key=key).exists(): raise Http404
    target=directory()/(key+'.webp')
    if not target.is_file(): raise Http404
    response=HttpResponse(target.read_bytes(),content_type='image/webp')
    response['X-Content-Type-Options']='nosniff';response['Cache-Control']='public, max-age=86400'
    return response

@api
@require_http_methods(['POST'])
def password(request):
    user=editable(request)
    value=body(request)
    current=value.get('currentPassword','');new=value.get('newPassword','')
    if not isinstance(current,str) or not user.check_password(current): raise ValidationError('Your current password is incorrect.')
    if not isinstance(new,str) or len(new)>200: raise ValidationError('Choose a password under 200 characters.')
    validate_password(new,user)
    user.set_password(new);user.save(update_fields=['password'])
    update_session_auth_hash(request,user)
    return JsonResponse({'saved':True})

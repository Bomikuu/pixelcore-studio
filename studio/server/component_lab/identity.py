from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from .models import StudioAccess

def authenticated(request):
    if not request.user.is_authenticated or not request.user.is_active:
        raise PermissionDenied('Sign in to Studio to continue.')
    return request.user

def session_payload(request):
    user = request.user
    active = bool(user.is_authenticated and user.is_active)
    source = request.session.get('studio_platform', '') if active else ''
    profile = getattr(user, 'studio_profile', None) if active else None
    remote = request.session.get('studio_user', {}) if source else {}
    return {
        'authenticated': active,
        'username': user.get_username() if active else '',
        'user': ({'id':str(user.pk), 'username':user.get_username(),
                  'displayName':remote.get('displayName') or (profile.display_name if profile else '') or user.get_full_name() or user.get_username(),
                  'email':remote.get('email', user.email), 'avatarUrl':remote.get('avatarUrl') or (f'/api/studio/profile/avatar/{profile.avatar_key}/' if profile and profile.avatar_key else ''),
                  'source':source or 'studio', 'settingsUrl':remote.get('settingsUrl','')} if active else None),
        'workspace': request.session.get('studio_workspace'),
        'capabilities': {'editWebsite':bool(active and (source or user.is_staff)), 'manageComponents':bool(active and user.is_staff and not source)},
        'csrfCookieName':settings.CSRF_COOKIE_NAME,
        'platforms':[{'id':key,'name':value['name'],'origin':value['frontendOrigin']} for key,value in settings.STUDIO_PLATFORMS.items()],
        'silentConnectAllowed': not request.session.get('studio_signed_out', False),
        'canEnroll':bool(settings.DEBUG and not get_user_model().objects.filter(is_staff=True).exists() and not StudioAccess.objects.filter(pk=1,enrolled=True).exists()),
    }

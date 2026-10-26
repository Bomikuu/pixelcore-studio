from website_builder.demo_settings import *
DEBUG = os.environ.get('STUDIO_DEBUG', 'true').lower() in {'1','true','yes'}
if not DEBUG:
    ALLOWED_HOSTS = [value.strip() for value in os.environ.get('STUDIO_ALLOWED_HOSTS','').split(',') if value.strip()]
INSTALLED_APPS = [*INSTALLED_APPS, 'component_lab']
ROOT_URLCONF = 'component_lab.root_urls'
AUTH_PASSWORD_VALIDATORS = [{'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}}]
COMPONENT_LAB_ORIGIN = os.environ.get('WEBSITE_BUILDER_COMPONENT_ORIGIN', 'http://localhost:4175')
FILE_UPLOAD_MAX_MEMORY_SIZE = 2_000_000
DATA_UPLOAD_MAX_MEMORY_SIZE = 24_000_000
X_FRAME_OPTIONS = 'DENY'
MIDDLEWARE = ['component_lab.middleware.UploadLimitMiddleware', *MIDDLEWARE]
SESSION_COOKIE_NAME = 'studio_sessionid'
CSRF_COOKIE_NAME = 'studio_csrftoken'
SESSION_COOKIE_AGE = 7 * 24 * 60 * 60
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
WEBSITE_BUILDER_STUDIO_AUTH = True
STUDIO_PLATFORMS = {}
_client_key = DATA_DIR / 'platform-client.key'
if DEBUG and not _client_key.exists():
    import secrets
    descriptor = os.open(str(_client_key), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as stream: stream.write(secrets.token_urlsafe(48))
_client_secret = os.environ.get('STUDIO_CLIENT_SECRET', '') or (_client_key.read_text().strip() if DEBUG else '')
if _client_secret:
    STUDIO_PLATFORMS['pixelcore'] = {
        'name':'PixelCore', 'frontendOrigin':os.environ.get('STUDIO_PIXELCORE_FRONTEND_ORIGIN','http://localhost:3001'),
        'apiOrigin':os.environ.get('STUDIO_PIXELCORE_API_ORIGIN','http://localhost:8000'),
        'clientSecret':_client_secret,
    }

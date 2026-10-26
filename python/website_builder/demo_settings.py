import os
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("WEBSITE_BUILDER_DATA_DIR", str(BASE_DIR / ".data")))
DATA_DIR.mkdir(exist_ok=True)
key_file = DATA_DIR / "secret.key"
if not key_file.exists():
    from secrets import token_urlsafe
    key_file.write_text(token_urlsafe(48))
    key_file.chmod(0o600)
SECRET_KEY = key_file.read_text()
DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]
INSTALLED_APPS = ["django.contrib.auth", "django.contrib.contenttypes", "django.contrib.sessions", "website_builder"]
DATABASES = {"default": {"ENGINE":"django.db.backends.sqlite3","NAME":DATA_DIR / "demo.sqlite3"}}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
ROOT_URLCONF = "website_builder.demo_urls"
MIDDLEWARE = ["django.middleware.security.SecurityMiddleware", "django.contrib.sessions.middleware.SessionMiddleware", "django.middleware.csrf.CsrfViewMiddleware", "django.contrib.auth.middleware.AuthenticationMiddleware"]
USE_TZ = True
TIME_ZONE = "Asia/Manila"
WEBSITE_BUILDER_AUTHORIZE = "website_builder.demo_hooks.authorize"
WEBSITE_BUILDER_RESOLVE_DATA = "website_builder.demo_hooks.resolve_data"
WEBSITE_BUILDER_REVIEW_DATA = "website_builder.demo_hooks.review_data"
WEBSITE_BUILDER_CAPABILITIES = "website_builder.demo_hooks.capabilities"
WEBSITE_BUILDER_FRONTEND_URL = os.environ.get("WEBSITE_BUILDER_FRONTEND_URL","http://localhost:4173")
CSRF_TRUSTED_ORIGINS = [WEBSITE_BUILDER_FRONTEND_URL, "http://127.0.0.1:4173"]

MEDIA_ROOT = DATA_DIR / "media"
MEDIA_URL = "/api/demo/media/"
WEBSITE_BUILDER_UPLOAD_MEDIA = "website_builder.demo_hooks.upload_media"

import hashlib
import secrets
from datetime import timedelta
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone
from website_builder.models import Website, Revision, ReviewShare
from website_builder.validation import normalize_global_fonts, validate_content_mode

class VersionConflict(Exception):
    pass

@transaction.atomic
def save_draft(website_id, document, expected_version, actor=None):
    if not isinstance(expected_version,int) or isinstance(expected_version,bool):
        raise ValidationError("Expected version must be an integer.")
    document = normalize_global_fonts(document)
    website = Website.objects.select_for_update().get(pk=website_id)
    if website.version != expected_version:
        raise VersionConflict("A newer draft exists. Reload before saving.")
    website.version += 1
    revision = Revision.objects.create(website=website, number=website.version, document=document, actor=actor if getattr(actor, "is_authenticated", False) else None)
    website.draft = revision
    website.save(update_fields=["version", "draft", "updated_at"])
    return website

@transaction.atomic
def publish(website_id, expected_version):
    if not isinstance(expected_version,int) or isinstance(expected_version,bool):
        raise ValidationError("Expected version must be an integer.")
    website = Website.objects.select_for_update().get(pk=website_id)
    if website.version != expected_version:
        raise VersionConflict("The draft changed before publication.")
    if not website.draft_id:
        raise ValidationError("Save a draft before publishing.")
    from .globals import linked_ids, _uuid, public_document
    from website_builder.models import GlobalSection
    referenced = linked_ids(website.draft.document)
    available = {str(identifier) for identifier in GlobalSection.objects.filter(tenant=website.tenant, id__in=[value for value in referenced if _uuid(value)], published__isnull=False).values_list('id', flat=True)}
    if referenced - available:
        raise ValidationError('Publish every linked global section before publishing this page. Missing or private links must be detached.')
    try:
        resolved_document = public_document(website.tenant, website.draft.document)
    except PermissionDenied as error:
        raise ValidationError(f'This page cannot be published: {error}') from error
    validate_content_mode(resolved_document)
    website.published = website.draft
    website.save(update_fields=["published", "updated_at"])
    return website

@transaction.atomic
def create_review(website_id, expected_version, resolved_data, *, lifetime=timedelta(days=7), can_comment=True):
    if not isinstance(expected_version,int) or isinstance(expected_version,bool):
        raise ValidationError("Expected version must be an integer.")
    website = Website.objects.select_for_update().get(pk=website_id)
    if website.version != expected_version:
        raise VersionConflict("Save the current draft before creating a review.")
    if not website.draft_id:
        raise ValidationError("Save a draft before creating a review.")
    if lifetime <= timedelta(0) or lifetime > timedelta(days=30):
        raise ValidationError("Review lifetime must be between zero and thirty days.")
    token = secrets.token_urlsafe(32)
    share = ReviewShare.objects.create(revision=website.draft, secret_hash=hashlib.sha256(token.encode()).hexdigest(), data_snapshot=resolved_data, expires_at=timezone.now()+lifetime, can_comment=can_comment)
    return share, token

def active_share(*, token=None, share_id=None):
    query = {"secret_hash": hashlib.sha256(token.encode()).hexdigest()} if token else {"pk": share_id}
    share = ReviewShare.objects.select_related("revision__website").filter(**query, revoked_at__isnull=True, expires_at__gt=timezone.now()).first()
    if not share:
        raise PermissionDenied("This review link is invalid, expired, or revoked.")
    return share


@transaction.atomic
def restore_revision(website_id, revision_id, expected_version, actor=None):
    """Append a historical design as a draft; publication and reviews stay fixed."""
    website = Website.objects.select_for_update().get(pk=website_id)
    revision = Revision.objects.get(pk=revision_id, website=website)
    return save_draft(website.id, revision.document, expected_version, actor)

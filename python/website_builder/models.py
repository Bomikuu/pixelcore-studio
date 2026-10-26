import uuid
from django.conf import settings
from django.db import models

class Website(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.CharField(max_length=160)
    key = models.CharField(max_length=160)
    version = models.PositiveIntegerField(default=0)
    draft = models.ForeignKey("Revision", null=True, blank=True, on_delete=models.PROTECT, related_name="draft_for")
    published = models.ForeignKey("Revision", null=True, blank=True, on_delete=models.PROTECT, related_name="published_for")
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["tenant", "key"], name="wb_tenant_website_key")]

class AnalyticsSetup(models.Model):
    website = models.OneToOneField(Website, on_delete=models.CASCADE)
    fingerprint = models.CharField(max_length=64)
    confirmed_at = models.DateTimeField()

class Revision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    website = models.ForeignKey(Website, on_delete=models.CASCADE, related_name="revisions")
    number = models.PositiveIntegerField()
    document = models.JSONField()
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["website", "number"], name="wb_revision_number")]
    def save(self, *args, **kwargs):
        if self.pk and not self._state.adding:
            raise ValueError("Website revisions are immutable.")
        return super().save(*args, **kwargs)

class ReviewShare(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    revision = models.ForeignKey(Revision, on_delete=models.CASCADE, related_name="shares")
    secret_hash = models.CharField(max_length=64, unique=True)
    data_snapshot = models.JSONField(default=dict)
    can_comment = models.BooleanField(default=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ReviewThread(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    share = models.ForeignKey(ReviewShare, on_delete=models.CASCADE, related_name="threads")
    node_id = models.CharField(max_length=100)
    field = models.CharField(max_length=80, blank=True)
    x = models.FloatField(default=.5)
    y = models.FloatField(default=.5)
    viewport = models.PositiveIntegerField(default=1100)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class ReviewComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(ReviewThread, on_delete=models.CASCADE, related_name="comments")
    display_name = models.CharField(max_length=80)
    body = models.TextField(max_length=4000)
    created_at = models.DateTimeField(auto_now_add=True)


class SavedSection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.CharField(max_length=160, db_index=True)
    name = models.CharField(max_length=100)
    node = models.JSONField()
    version = models.PositiveIntegerField(default=1)
    archived = models.BooleanField(default=False)
    tags = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)


class SavedTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.CharField(max_length=160, db_index=True)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=300, blank=True)
    document = models.JSONField()
    version = models.PositiveIntegerField(default=1)
    archived = models.BooleanField(default=False)
    tags = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)


class GlobalSection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.CharField(max_length=160, db_index=True)
    name = models.CharField(max_length=100)
    version = models.PositiveIntegerField(default=0)
    draft = models.ForeignKey("GlobalSectionRevision", null=True, blank=True, on_delete=models.PROTECT, related_name="draft_for")
    published = models.ForeignKey("GlobalSectionRevision", null=True, blank=True, on_delete=models.PROTECT, related_name="published_for")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class GlobalSectionRevision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.ForeignKey(GlobalSection, on_delete=models.CASCADE, related_name="revisions")
    number = models.PositiveIntegerField()
    node = models.JSONField()
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["section", "number"], name="wb_global_revision_number")]
    def save(self, *args, **kwargs):
        if self.pk and not self._state.adding:
            raise ValueError("Global section revisions are immutable.")
        return super().save(*args, **kwargs)


class SavedTemplateRevision(models.Model):
    template = models.ForeignKey(SavedTemplate, on_delete=models.CASCADE, related_name="revisions")
    number = models.PositiveIntegerField()
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=300, blank=True)
    tags = models.JSONField(default=list)
    document = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["template", "number"], name="wb_template_revision_number")]
    def save(self, *args, **kwargs):
        if not self._state.adding: raise ValueError("Template versions are immutable.")
        return super().save(*args, **kwargs)


class DemoMedia(models.Model):
    """Standalone demonstration assets only. Production hosts use their own library."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.CharField(max_length=160, db_index=True)
    name = models.CharField(max_length=500)
    alt = models.CharField(max_length=250, blank=True)
    metadata = models.JSONField(default=dict)

import uuid
from django.conf import settings
from django.db import models

class StudioAccess(models.Model):
    enrolled = models.BooleanField(default=False)

class Component(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    name = models.CharField(max_length=100)
    approved_version = models.PositiveIntegerField(null=True)
    updated_at = models.DateTimeField(auto_now=True)

class ComponentVersion(models.Model):
    component = models.ForeignKey(Component, related_name='versions', on_delete=models.CASCADE)
    number = models.PositiveIntegerField()
    manifest = models.JSONField()
    files = models.JSONField(default=dict)
    native_document = models.JSONField(null=True)
    storage_key = models.CharField(max_length=64)
    byte_size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['component', 'number'], name='studio_component_version_unique')]
        ordering = ['-number']
    def save(self, *args, **kwargs):
        if self.pk: raise ValueError('Component versions are immutable. Upload a new version.')
        super().save(*args, **kwargs)

class Approval(models.Model):
    version = models.OneToOneField(ComponentVersion, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

class StudioProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name='studio_profile', on_delete=models.CASCADE)
    display_name = models.CharField(max_length=100, blank=True)
    avatar_key = models.CharField(max_length=64, blank=True)

class PlatformIdentity(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name='platform_identity', on_delete=models.CASCADE)
    issuer = models.CharField(max_length=80)
    subject = models.CharField(max_length=100)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['issuer','subject'],name='studio_platform_subject_unique')]

class PlatformConnection(models.Model):
    session_key = models.CharField(max_length=64, unique=True)
    platform = models.CharField(max_length=80)
    grant = models.CharField(max_length=128)
    business_id = models.CharField(max_length=80)
    expires_at = models.DateTimeField()

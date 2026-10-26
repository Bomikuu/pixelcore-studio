from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.utils.module_loading import import_string

def hook(name):
    callback = getattr(settings, "WEBSITE_BUILDER_"+name, None)
    return import_string(callback) if isinstance(callback,str) else callback

class AuthenticationRequired(PermissionDenied):
    pass

def authorize(request, website, action):
    callback = hook("AUTHORIZE")
    if not callback or not callback(request,website,action):
        if not getattr(getattr(request,"user",None),"is_authenticated",False):
            raise AuthenticationRequired("Sign in to manage this website.")
        raise PermissionDenied("This website action is not permitted.")

def resolve_data(request, website, *, review=False):
    callback = hook("RESOLVE_DATA")
    if not callback:
        raise PermissionDenied("The host has not configured public-safe data resolution.")
    from website_builder.services.globals import resolve_global_sections
    data = callback(request, website, review=review)
    document = website.draft.document if website.draft_id else {"children": []}
    return resolve_global_sections(website.tenant, document, data, stage="draft")

def review_data(request, share):
    callback = hook("REVIEW_DATA")
    if not callback:
        raise PermissionDenied("The host has not configured review access revalidation.")
    return callback(request, share)

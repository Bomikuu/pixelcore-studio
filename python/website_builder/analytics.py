import copy
import hashlib
import json
import re
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
from django.conf import settings
from django.db import transaction
from .models import Website, AnalyticsSetup

def validate_analytics(value):
    if value is None: return {'provider':'none','domain':''}
    if not isinstance(value,dict) or set(value)-{'provider','domain','measurementId','scriptUrl'}: raise ValidationError('Invalid analytics configuration.')
    provider=value.get('provider')
    if provider not in {'none','google','plausible'}: raise ValidationError('Choose a supported analytics provider.')
    if provider=='none': return {'provider':'none','domain':''}
    domain=value.get('domain')
    if not isinstance(domain,str) or len(domain)>253 or not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}',domain): raise ValidationError('Enter a public domain such as example.com, without a URL or path.')
    if provider=='google':
        tag=value.get('measurementId')
        if not isinstance(tag,str) or not re.fullmatch(r'(G|AW)-[A-Z0-9]{4,32}',tag): raise ValidationError('Enter the Google tag ID from your web data stream.')
        return {'provider':provider,'domain':domain,'measurementId':tag}
    url=value.get('scriptUrl')
    if not isinstance(url,str) or not re.fullmatch(r'https://plausible\.io/js/[a-zA-Z0-9._-]{1,120}\.js',url): raise ValidationError('Use the HTTPS plausible.io/js/ script URL from your site installation instructions.')
    return {'provider':provider,'domain':domain,'scriptUrl':url}

def fingerprint(config): return hashlib.sha256(json.dumps(config,sort_keys=True).encode()).hexdigest()

@transaction.atomic
def analytics_operation(user,tenant,args):
    from .services.revisions import save_draft, publish
    site=Website.objects.select_related('draft','published').filter(pk=args.get('websiteId'),tenant=tenant).first()
    if not site: raise PermissionDenied('This website is unavailable in your workspace.')
    method=args.get('method','GET')
    if method=='PUT':
        config=validate_analytics(args.get('config'))
        if not site.draft_id: raise ValidationError('Open the builder and save your website first.')
        doc=copy.deepcopy(site.draft.document);doc['analytics']=config
        site=save_draft(site.pk,doc,args.get('expectedVersion'),user)
    if method=='POST':
        if args.get('action')=='publish':
            site=publish(site.pk,args.get('expectedVersion'))
            from .hooks import hook
            callback=hook('AFTER_PUBLISH')
            if callback:
                from django.test import RequestFactory
                request=RequestFactory().post('/');request.user=user
                callback(request,site)
        elif args.get('action')=='confirm':
            if not site.published_id: raise ValidationError('Publish your configuration before confirming verification.')
            config=validate_analytics(site.published.document.get('analytics'))
            if config['provider']=='none': raise ValidationError('Configure and publish a provider first.')
            AnalyticsSetup.objects.update_or_create(website=site,defaults={'fingerprint':fingerprint(config),'confirmed_at':timezone.now()})
        else: raise ValidationError('Choose a supported analytics action.')
    draft=validate_analytics(site.draft.document.get('analytics') if site.draft_id else None)
    live=validate_analytics(site.published.document.get('analytics') if site.published_id else None)
    progress=AnalyticsSetup.objects.filter(website=site,fingerprint=fingerprint(live)).first()
    status='Not configured' if draft['provider']=='none' and live['provider']=='none' else 'Draft configuration' if draft!=live else 'User-confirmed verification' if progress else 'Published—verification needed'
    return {'draft':draft,'published':live,'status':status,'verification':progress.confirmed_at.isoformat() if progress else None,'consentAvailable':bool(getattr(settings,'WEBSITE_BUILDER_ANALYTICS_CONSENT_AVAILABLE',False)),'version':site.version,'publishedRevision':str(site.published_id) if site.published_id else None}

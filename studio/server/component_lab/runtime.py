import json, posixpath
from django.conf import settings
from django.core import signing
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from .imports import path as safe_path, TYPES
from .models import ComponentVersion, Approval
from .views import SALT

BRIDGE = r'''<script>
(()=>{let channel='',state={settings:{},data:{},theme:{},motion:true,visible:true};
const send=(type,value={})=>{if(channel)parent.postMessage({channel,type,...value},'*')};
addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='component:init'||typeof event.data.channel!=='string')return;
channel=event.data.channel;state={settings:event.data.settings||{},data:event.data.data||{},theme:event.data.theme||{},motion:event.data.motion!==false,visible:event.data.visible!==false};
for(const [key,value]of Object.entries(state.theme.colors||{}))if(/^[a-zA-Z]+$/.test(key)&&/^#[a-fA-F0-9]{6}$/.test(value))document.documentElement.style.setProperty('--brand-'+key,value);
dispatchEvent(new CustomEvent('component:update',{detail:state}));send('ready');});
Object.defineProperty(window,'ComponentLab',{value:{getState:()=>structuredClone(state),onUpdate:fn=>{const listener=e=>fn(e.detail);addEventListener('component:update',listener);fn(state);return()=>removeEventListener('component:update',listener)}}});
addEventListener('error',e=>send('error',{message:String(e.message||'The component encountered an error.').slice(0,500)}));
addEventListener('unhandledrejection',e=>send('error',{message:String(e.reason?.message||e.reason||'A resource could not load.').slice(0,500)}));
})();
</script>'''

@require_http_methods(['GET'])
def asset(request, ticket, component_id, number, file_path):
    version = get_object_or_404(ComponentVersion, component_id=component_id, number=number)
    if ticket == 'public':
        if not Approval.objects.filter(version=version).exists(): return HttpResponse('This version is not in the catalog.', status=404)
    else:
        try:
            signed = signing.loads(ticket, salt=SALT, max_age=3600)
            if signed != {'id': str(component_id), 'version': number}: raise signing.BadSignature()
        except signing.BadSignature: return HttpResponse('This preview link expired. Reopen the component.', status=403)
    try: file_path = safe_path(file_path)
    except Exception: return HttpResponse('Not found', status=404)
    if file_path not in version.files: return HttpResponse('Not found', status=404)
    try: raw = (settings.DATA_DIR / 'component-lab' / version.storage_key / file_path).read_bytes()
    except FileNotFoundError: return HttpResponse('This asset is unavailable.', status=404)
    suffix = __import__('pathlib').PurePosixPath(file_path).suffix.lower()
    html = suffix == '.html'
    if html:
        source = raw.decode('utf-8-sig')
        imports = version.manifest.get('imports', {})
        # All package-local modules resolve relative to this document, including nested entries.
        importmap = '<script type="importmap">'+json.dumps({'imports': {k: './'+posixpath.relpath(v.removeprefix('./'), str(__import__('pathlib').PurePosixPath(version.manifest['entry']).parent)) if not v.startswith('https:') else v for k,v in imports.items()}}).replace('<', '\\u003c')+'</script>' if imports else ''
        raw = ('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+importmap+BRIDGE+source).encode()
    response = HttpResponse(raw, content_type=TYPES.get(suffix, 'application/octet-stream'))
    origins = ' '.join(version.manifest.get('networkOrigins', []))
    origin = settings.COMPONENT_LAB_ORIGIN
    response['Content-Security-Policy'] = f"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' {origin} {origins}; style-src 'unsafe-inline' {origin} {origins}; img-src data: blob: {origin} {origins}; media-src blob: {origin} {origins}; font-src {origin} {origins}; connect-src {origin} {origins}; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
    response['Access-Control-Allow-Origin'] = '*'
    response['Cross-Origin-Resource-Policy'] = 'cross-origin'
    response['X-Content-Type-Options'] = 'nosniff'
    response['Referrer-Policy'] = 'no-referrer'
    response['X-Robots-Tag'] = 'noindex, nofollow'
    response['Cache-Control'] = 'public, max-age=31536000, immutable' if ticket == 'public' else 'no-store'
    return response

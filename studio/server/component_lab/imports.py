"""Read browser-ready packages as data. Never install dependencies or execute uploads."""
import io, json, re, stat, zipfile
from pathlib import PurePosixPath
from urllib.parse import urlsplit
from django.core.exceptions import ValidationError
from website_builder.validation import validate_document

MAX_UPLOAD = 20_000_000
MAX_EXPANDED = 60_000_000
TYPES = {'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.avif': 'image/avif', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain'}
KEY = re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,39}$')

def fail(message): raise ValidationError(message)
def text(value, label, maximum=300):
    if not isinstance(value, str) or len(value) > maximum: fail(f'Invalid {label}.')
    return value.strip()
def path(value):
    if not isinstance(value, str) or not value or len(value) > 240 or '\\' in value or any(ord(c) < 32 for c in value) or any(c in value for c in '?#%:'):
        fail('Invalid package file path.')
    p = PurePosixPath(value)
    if p.is_absolute() or any(x in {'', '.', '..'} for x in value.split('/')) or str(p) != value:
        fail('Package paths must stay inside the uploaded folder.')
    return value

def manifest(value):
    if not isinstance(value, dict) or value.get('schemaVersion') != 1: fail('component.json needs schemaVersion 1.')
    allowed = {'schemaVersion', 'name', 'description', 'kind', 'usage', 'entry', 'poster', 'sourceUrl', 'author', 'license', 'tags', 'fields', 'dataKeys', 'networkOrigins', 'imports', 'fallbackText', 'height'}
    if set(value) - allowed: fail('Unsupported component manifest setting.')
    result = {'schemaVersion': 1, 'name': text(value.get('name', ''), 'name', 100)}
    if not result['name']: fail('Give this component a name.')
    for key, maximum in [('description', 500), ('sourceUrl', 2000), ('author', 100), ('license', 300), ('fallbackText', 300)]: result[key] = text(value.get(key, ''), key, maximum)
    if result['sourceUrl'] and urlsplit(result['sourceUrl']).scheme not in {'https', 'http'}: fail('Use an HTTP source link.')
    for key, choices, default in [('kind', {'section', 'component', 'background'}, 'section'), ('usage', {'landing', 'storefront', 'event', 'general'}, 'general')]:
        if value.get(key, default) not in choices: fail(f'Invalid {key}.')
        result[key] = value.get(key, default)
    height = value.get('height', 420)
    if not isinstance(height, int) or isinstance(height, bool) or not 120 <= height <= 1200: fail('Preview height must be 120–1200px.')
    result['height'] = height
    result['entry'] = path(value.get('entry', 'index.html'))
    if not result['entry'].endswith('.html'): fail('Choose an HTML entry file.')
    result['poster'] = path(value['poster']) if value.get('poster') else ''
    if result['poster'] and PurePosixPath(result['poster']).suffix.lower() not in {'.png', '.jpg', '.jpeg', '.webp', '.avif'}: fail('Use a raster poster image.')
    tags = value.get('tags', [])
    if not isinstance(tags, list) or len(tags) > 10: fail('Use at most ten tags.')
    result['tags'] = [text(v, 'tag', 30) for v in tags]
    origins = value.get('networkOrigins', [])
    if not isinstance(origins, list) or len(origins) > 8: fail('Use at most eight approved resource origins.')
    result['networkOrigins'] = []
    for origin in origins:
        u = urlsplit(origin) if isinstance(origin, str) else None
        if not u or u.scheme != 'https' or not u.hostname or u.username or u.password or u.path or u.query or u.fragment or len(origin) > 200: fail('Resource origins must be exact HTTPS origins without a path.')
        result['networkOrigins'].append(origin)
    imports = value.get('imports', {})
    if not isinstance(imports, dict) or len(imports) > 20: fail('Invalid module import map.')
    result['imports'] = {}
    for key, target in imports.items():
        if not isinstance(key, str) or not re.fullmatch(r'[@A-Za-z0-9_./-]{1,100}', key) or not isinstance(target, str): fail('Invalid module import.')
        u = urlsplit(target)
        if u.scheme:
            if f'{u.scheme}://{u.netloc}' not in result['networkOrigins'] or not re.search(r'@\d+\.\d+\.\d+/', u.path): fail('External modules need an approved origin and an exact pinned version.')
        else: path(target.removeprefix('./'))
        result['imports'][key] = target
    fields = value.get('fields', [])
    if not isinstance(fields, list) or len(fields) > 20: fail('Use at most twenty editable settings.')
    result['fields'] = []
    seen = set()
    for field in fields:
        if not isinstance(field, dict) or set(field) - {'key', 'label', 'type', 'default', 'min', 'max', 'options'}: fail('Invalid editable setting.')
        key = field.get('key')
        if not isinstance(key, str) or not KEY.fullmatch(key) or key.lower() in {'constructor', 'prototype', '__proto__', 'guest', 'guests', 'patient', 'patients', 'encounter', 'encounters'} or key in seen: fail('Setting keys must be unique names.')
        seen.add(key)
        kind = field.get('type', 'text')
        if kind not in {'text', 'color', 'number', 'select', 'image'}: fail('Unsupported setting type.')
        f = {'key': key, 'label': text(field.get('label', key), 'setting label', 60), 'type': kind}
        if kind == 'number':
            low, high = field.get('min', 0), field.get('max', 100)
            if not all(isinstance(n, (int, float)) and not isinstance(n, bool) and -10000 <= n <= 10000 for n in [low, high]) or low > high: fail('Invalid numeric setting range.')
            f.update(min=low, max=high)
        if kind == 'select':
            options = field.get('options', [])
            if not isinstance(options, list) or not 1 <= len(options) <= 20: fail('A choice setting needs options.')
            f['options'] = [text(v, 'option', 80) for v in options]
        f['default'] = field.get('default', f.get('min', '') if kind == 'number' else '#125b50' if kind == 'color' else f.get('options', [''])[0])
        validate_settings([f], {key: f['default']})
        result['fields'].append(f)
    keys = value.get('dataKeys', [])
    if not isinstance(keys, list) or len(keys) > 12 or any(not isinstance(k, str) or not KEY.fullmatch(k) or k.lower() in {'guest', 'guests', 'patient', 'patients', 'encounter', 'encounters', 'constructor', 'prototype'} for k in keys): fail('Declare only named public data inputs.')
    result['dataKeys'] = keys
    return result

def validate_settings(fields, values):
    import math
    if not isinstance(values, dict) or set(values) - {f['key'] for f in fields}: fail('Unknown editable setting.')
    for f in fields:
        if f['key'] not in values: continue
        v = values[f['key']]
        if f['type'] == 'number':
            if not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v) or not f['min'] <= v <= f['max']: fail('Numeric setting is outside its range.')
        elif not isinstance(v, str) or len(v) > 2000: fail('Invalid setting value.')
        elif f['type'] == 'color' and not re.fullmatch(r'#[a-fA-F0-9]{6}', v): fail('Use a six-digit color.')
        elif f['type'] == 'select' and v not in f['options']: fail('Choose an available option.')
        elif f['type'] == 'image' and v and (urlsplit(v).scheme != 'https' or urlsplit(v).username): fail('Use an HTTPS image link.')
    return values

def read_upload(upload, supplied=None):
    if upload.size > MAX_UPLOAD: fail('Upload a ZIP or JSON file under 20 MB.')
    raw = upload.read(MAX_UPLOAD + 1)
    if len(raw) > MAX_UPLOAD: fail('The upload is too large.')
    files, native = {}, None
    if upload.name.lower().endswith('.json'):
        value = json.loads(raw)
        native = value.get('document', value) if isinstance(value, dict) else value
        validate_document(native)
        # Reusable imports cannot capture source authorization, private widgets or linked sources.
        def sanitize(n):
            if n.get('type') in {'widget', 'global-section', 'component'}: fail('Import native sections without host widgets or linked sources.')
            for v in n.get('props', {}).values():
                if isinstance(v, dict) and 'source' in v: fail('Reconnect live data in the destination project after import.')
            for child in n.get('children', []): sanitize(child)
        sanitize(native)
        native.pop('context', None)
        m = {'schemaVersion': 1, 'name': native.get('title', 'Imported section'), **(supplied or {})}
    elif upload.name.lower().endswith('.zip'):
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                entries = archive.infolist()
                if len(entries) > 150: fail('Use at most 150 files per package.')
                total = 0
                for item in entries:
                    if item.is_dir():
                        path(item.filename.rstrip('/')); continue
                    name = path(item.filename)
                    if name in files or stat.S_ISLNK(item.external_attr >> 16) or item.flag_bits & 1: fail('Duplicate paths, symlinks and encrypted files are unsupported.')
                    if PurePosixPath(name).suffix.lower() not in TYPES: fail(f'Unsupported package file: {name}')
                    total += item.file_size
                    if total > MAX_EXPANDED or item.file_size > MAX_UPLOAD or (item.file_size > 1_000_000 and item.file_size > max(1, item.compress_size) * 150): fail('The expanded package is too large.')
                    files[name] = archive.read(item)
                if 'component.json' not in files: fail('Include component.json at the ZIP root. Download the starter package for an example.')
                m = json.loads(files['component.json'])
                if supplied: m.update(supplied)
        except (zipfile.BadZipFile, RuntimeError, NotImplementedError) as error: fail('The ZIP could not be read. Export an unencrypted ZIP archive.')
    else: fail('Choose a ZIP package or builder JSON file.')
    m = manifest(m)
    if native is None:
        if m['entry'] not in files: fail('The HTML entry file is missing.')
        if m['poster'] and m['poster'] not in files: fail('The poster image is missing.')
        for target in m['imports'].values():
            if not urlsplit(target).scheme and target.removeprefix('./') not in files: fail(f'Module file is missing: {target}')
        # Report missing static local references instead of opening a broken preview.
        for name, content in files.items():
            if PurePosixPath(name).suffix.lower() not in {'.html', '.css', '.js', '.mjs'}: continue
            source = content.decode('utf-8-sig')
            refs = re.findall(r'''(?:src|href)\s*=\s*["']([^"']+)["']|(?:from\s*|import\s*)["'](\.[^"']+)["']|url\(\s*["']?([^)'"\s]+)''', source)
            for group in refs:
                ref = next((v for v in group if v), '').split('#')[0].split('?')[0]
                if not ref or ref.startswith(('data:', 'https:', 'http:', '//')): continue
                if name == m['entry'] and ref.startswith('#'): continue
                import posixpath
                target = posixpath.normpath(posixpath.join(str(PurePosixPath(name).parent), ref))
                if target not in files: fail(f'Missing file referenced by {name}: {ref}')
    return m, files, native

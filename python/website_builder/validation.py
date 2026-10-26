import json
import math
import re
from django.core.exceptions import ValidationError

TYPES = {"component", "accordion", "tabs", "video", "header", "footer", "widget", "spacer", "page", "section", "container", "columns", "heading", "text", "image", "button", "divider", "gallery", "products", "services", "event-schedule", "repeater", "global-section"}
CONTAINERS = {"page", "section", "container", "columns", "repeater", "global-section"}
ROLES = {"background", "surface", "text", "muted", "primary", "onPrimary", "accent", "border"}
FONTS = {"Manrope", "Newsreader", "Georgia", "Arial", "Verdana", "Trebuchet MS", "Bodoni Moda", "Cormorant Garamond", "Italiana", "system-ui"}
HEX = re.compile(r"^#[a-fA-F0-9]{6}$")
PRIVATE_SOURCES = {"guest", "guests", "patient", "patients", "encounter", "encounters"}
SAFE_PATH = re.compile(r"^[\w.-]{1,160}$", re.ASCII)

def validate_content_mode(document):
    """Drafts remain recoverable; a published fixed body must be authored content."""
    if document.get('mode') != 'fixed':
        return
    live_types = {'products', 'services', 'event-schedule', 'repeater', 'widget'}
    def visit(node):
        if node.get('type') in {'header', 'footer'}:
            return
        connected = any(isinstance(value, dict) and value.get('source') and 'path' in value for value in node.get('props', {}).values())
        if node.get('type') in live_types or connected:
            raise ValidationError('This fixed page contains live content. Choose Live data, or remove or detach its connected sections before publishing.')
        for child in node.get('children', []):
            visit(child)
    visit(document)

def safe_path(value):
    return isinstance(value, str) and SAFE_PATH.fullmatch(value) and not {"__proto__", "prototype", "constructor"}.intersection(value.split("."))

def safe_source(value):
    return safe_path(value) and not PRIVATE_SOURCES.intersection(value.split("."))

FORBIDDEN = {"__proto__", "prototype", "constructor", "html", "javascript", "raw_html", "script", "css"}

def validate_document(document):
    if isinstance(document,dict) and 'analytics' in document:
        from .analytics import validate_analytics
        validate_analytics(document['analytics'])
    if not isinstance(document, dict) or document.get("schemaVersion") != 1 or document.get("type") != "page" or document.get("mode") not in {"live", "fixed"}:
        raise ValidationError("Unsupported website document.")
    if len(json.dumps(document, ensure_ascii=False).encode()) > 500_000:
        raise ValidationError("Website document is too large.")
    if not isinstance(document.get("title"),str) or len(document["title"])>180:
        raise ValidationError("Invalid website title.")
    context=document.get('context')
    if context is not None and (not isinstance(context,dict) or set(context)!={'version','purpose','sourceId','setupComplete'} or context.get('version')!=1 or context.get('purpose') not in {'storefront','event','landing'} or not isinstance(context.get('sourceId'),str) or len(context['sourceId'])>160 or context.get('setupComplete')!=1):
        raise ValidationError('Invalid website context.')
    validate_page_settings(document.get("seo"))
    seen = set()
    def walk_value(value, depth=0):
        if depth > 25:
            raise ValidationError("Website settings are too deeply nested.")
        if isinstance(value, dict):
            if FORBIDDEN.intersection(value):
                raise ValidationError("Executable website content is not allowed.")
            for item in value.values():
                walk_value(item, depth + 1)
        elif isinstance(value, list):
            for item in value:
                walk_value(item, depth + 1)
    walk_value(document)
    def visit(node, depth=0):
        if not isinstance(node, dict) or depth > 8 or len(seen) >= 500:
            raise ValidationError("Invalid website nesting.")
        identifier = node.get("id")
        if not isinstance(identifier, str) or not identifier or len(identifier) > 100 or identifier in seen:
            raise ValidationError("Invalid or duplicate element identity.")
        seen.add(identifier)
        kind = node.get("type")
        children = node.get("children")
        if kind not in TYPES or not isinstance(children, list) or (children and kind not in CONTAINERS):
            raise ValidationError("Invalid website element.")
        props = node.get("props")
        if not isinstance(props, dict) or set(props) - {"name", "text", "level", "href", "assetId", "assetIds", "alt", "caption", "source", "limit", "action", "collection", "fit", "variant", "widgetId", "componentId", "componentVersion", "componentSettings", "fallbackText", "offset", "sortField", "sortDirection", "filterField", "filterValue", "emptyText", "sectionId", "items", "aspect", "focalX", "focalY", "decorative", "posterId"}:
            raise ValidationError("Unsupported website properties.")
        validate_content_props(kind, props)
        if kind == 'component':
            if not isinstance(props.get('componentId'), str) or not re.fullmatch(r'[a-fA-F0-9-]{36}', props['componentId']) or not isinstance(props.get('componentVersion'), int) or isinstance(props.get('componentVersion'), bool) or not 1 <= props['componentVersion'] <= 100: raise ValidationError('Invalid component catalog reference.')
            import json
            try: values = json.loads(props.get('componentSettings', '{}'))
            except (ValueError, TypeError): raise ValidationError('Invalid component settings.')
            if not isinstance(values, dict) or len(values) > 20 or any(not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,39}', k) or k.lower() in {'constructor', 'prototype', '__proto__'} or not ((isinstance(v, str) and len(v) <= 2000) or (isinstance(v, (int,float)) and not isinstance(v,bool) and math.isfinite(v))) for k,v in values.items()): raise ValidationError('Invalid component settings.')
        for key,value in props.items():
            if key == "items": continue
            if isinstance(value,dict):
                if key not in {"text", "href", "assetId", "alt"} or not {"source", "path"} <= set(value) or set(value) - {"source", "path", "format"} or not safe_source(value.get("source")) or not safe_path(value.get("path")) or ("format" in value and value["format"] not in {"text", "currency", "date"}):
                    raise ValidationError("Invalid data connection.")
            elif isinstance(value,list):
                if key!="assetIds" or len(value)>50 or any(not isinstance(v,str) or len(v)>160 for v in value):
                    raise ValidationError("Invalid asset selection.")
            elif isinstance(value,str):
                if len(value)>(50000 if key=="componentSettings" else 12000):raise ValidationError("Website text is too long.")
            elif not isinstance(value,(int,float)) or isinstance(value,bool) or not math.isfinite(value):
                raise ValidationError("Invalid property value.")
        if "level" in props and props["level"] not in [1,2,3,4,5,6]:raise ValidationError("Invalid heading level.")
        if "limit" in props and (not isinstance(props["limit"],int) or isinstance(props["limit"],bool) or not 1<=props["limit"]<=50):raise ValidationError("Invalid item limit.")
        if "source" in props and not safe_source(props["source"]):
            raise ValidationError("Unsupported public data source.")
        if "offset" in props and (not isinstance(props["offset"], int) or isinstance(props["offset"], bool) or not 0 <= props["offset"] <= 10000):
            raise ValidationError("Invalid repeater offset.")
        for field in ("sortField", "filterField"):
            if field in props and props[field] != "" and not safe_path(props[field]): raise ValidationError("Invalid repeater field.")
        if "sortDirection" in props and props["sortDirection"] not in {"asc", "desc"}: raise ValidationError("Invalid sort direction.")
        for field, maximum in (("filterValue", 200), ("emptyText", 300), ("sectionId", 100)):
            if field in props and (not isinstance(props[field], str) or len(props[field]) > maximum): raise ValidationError("Invalid section or repeater setting.")
        if kind == "repeater" and (len(children) != 1 or not isinstance(children[0], dict) or children[0].get("type") not in {"container", "section", "columns"} or (not safe_source(props.get("source")) or "item" in props["source"].split("."))):
            raise ValidationError("A repeater needs one card template and an approved collection.")
        if kind == "repeater":
            def unsafe_card(value):
                if not isinstance(value, dict): return False
                nested = value.get("children", [])
                return value.get("type") in {"component", "widget", "header", "footer", "global-section", "repeater"} or any(unsafe_card(child) for child in (nested if isinstance(nested, list) else []))
            if unsafe_card(children[0]):
                raise ValidationError("Repeater cards cannot contain widgets, page frames, linked sections, or nested repeaters.")
        if kind == "global-section":
            if not isinstance(props.get("sectionId"), str) or not re.fullmatch(r"[\w-]{1,100}", props["sectionId"], re.ASCII) or len(children) != 1 or not isinstance(children[0], dict) or children[0].get("type") != "section": raise ValidationError("A linked section needs one fallback section.")
            def contains_link(value):
                return isinstance(value, dict) and (value.get("type") == "global-section" or any(contains_link(child) for child in value.get("children", [])))
            if contains_link(children[0]): raise ValidationError("Linked sections cannot contain other links.")
        if kind=='widget' and props.get('widgetId') not in {'pixelcore.event-rsvp','pixelcore.event-people','pixelcore.event-story','pixelcore.event-countdown','pixelcore.event-venue','pixelcore.event-notes','pixelcore.event-gifts','pixelcore.event-wishes','pixelcore.social-links'}:
            raise ValidationError('Unsupported host widget.')
        validate_styles(node.get("style", {}))
        responsive=node.get("responsive", {})
        if not isinstance(responsive,dict) or set(responsive)-{"phone","tablet"}:
            raise ValidationError("Invalid responsive settings.")
        for styles in responsive.values():
            validate_styles(styles)
        for child in children:
            visit(child, depth + 1)
    visit(document)
    for kind in ['header','footer']:
        if sum(n.get('type')==kind for n in document['children'])>1:raise ValidationError('Only one header and footer are allowed.')
    theme = document.get("theme", {})
    colors = theme.get("colors", {})
    if set(colors) != ROLES or any(not isinstance(v, str) or not HEX.fullmatch(v) for v in colors.values()):
        raise ValidationError("Invalid website theme colors.")
    if any(theme.get(k) not in FONTS for k in ("bodyFont", "headingFont")):
        raise ValidationError("Unsupported website font.")
    for key,low,high in [("baseSize",12,28),("scale",1,2),("radius",0,48)]:
        if not isinstance(theme.get(key),(int,float)) or isinstance(theme.get(key), bool) or not math.isfinite(theme[key]) or not low <= theme[key] <= high:
            raise ValidationError("Invalid theme size.")
    return document

def node_ids(document):
    result = set()
    def visit(node):
        result.add(node["id"])
        for child in node.get("children", []):
            visit(child)
    visit(document)
    return result

STYLE_BOUNDS = {"fontSize":(8,128),"fontWeight":(100,900),"lineHeight":(.8,3),"letterSpacing":(-.04,.3),"padding":(0,240),"gap":(0,160),"maxWidth":(100,2400),"minHeight":(0,1600),"height":(0,1600),"opacity":(0,1),"borderRadius":(0,200),"borderWidth":(0,12),"gridColumns":(1,6),"paddingTop":(0,240),"paddingRight":(0,240),"paddingBottom":(0,240),"paddingLeft":(0,240),"width":(1,100),"minWidth":(0,2400)}
STYLE_ENUMS={"borderStyle":{"solid","dashed","none"},"boxShadow":{"none","soft","lifted"},"overflow":{"visible","hidden"},"textAlign":{"left","center","right"},"display":{"block","grid","flex","none"},"alignItems":{"start","center","end","stretch"},"flexDirection":{"row","column"},"flexWrap":{"wrap","nowrap"},"justifyContent":{"start","center","end","space-between"}}
def validate_styles(style):
    import math
    allowed=set(STYLE_BOUNDS)|set(STYLE_ENUMS)|{"color","backgroundColor","borderColor","fontFamily","background","motion","freeform"}
    if not isinstance(style,dict) or set(style)-allowed:
        raise ValidationError("Unsupported website style.")
    for key,value in style.items():
        if key in STYLE_BOUNDS:
            low,high=STYLE_BOUNDS[key]
            if not isinstance(value,(int,float)) or isinstance(value,bool) or not math.isfinite(value) or not low<=value<=high:
                raise ValidationError("Invalid website style number.")
        elif key in STYLE_ENUMS and (not isinstance(value,str) or value not in STYLE_ENUMS[key]):
            raise ValidationError("Invalid style choice.")
        elif key in {"color","backgroundColor","borderColor"} and (not isinstance(value,str) or (value not in ROLES and not HEX.fullmatch(value) and not (key!="color" and value=="transparent"))):
            raise ValidationError("Invalid style color.")
        elif key=="fontFamily" and value not in FONTS:
            raise ValidationError("Unsupported website font.")
        elif key=="background":
            if not isinstance(value,dict) or value.get("type") not in {"solid","gradient","image","video"} or set(value)-{"type","color","overlay","from","to","opacity","angle","assetId","posterId","fit","focal"}:
                raise ValidationError("Invalid website background.")
            for item in ["color","overlay","from","to"]:
                if item in value and (not isinstance(value[item],str) or not HEX.fullmatch(value[item])):
                    raise ValidationError("Invalid background color.")
            for item,high in [("opacity",1),("angle",360)]:
                if item in value and (not isinstance(value[item],(int,float)) or not math.isfinite(value[item]) or not 0<=value[item]<=high):
                    raise ValidationError("Invalid background setting.")
            if "fit" in value and value["fit"] not in {"cover","contain"}:
                raise ValidationError("Invalid background fit.")
            if "focal" in value and (not isinstance(value["focal"],str) or not re.fullmatch(r"\d{1,3}% \d{1,3}%",value["focal"])):
                raise ValidationError("Invalid background focal point.")
        elif key=="motion":
            if not isinstance(value,dict) or value.get("preset") not in {"none","fade","rise","slide","scale"} or not isinstance(value.get("duration"),(int,float)) or not 100<=value["duration"]<=1200 or not isinstance(value.get("delay"),(int,float)) or not 0<=value["delay"]<=1500:
                raise ValidationError("Invalid motion setting.")
        elif key=="freeform":
            if not isinstance(value,dict) or set(value)-{"x","y","width","height","z"} or any(not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<=v<=1600 for v in value.values()):
                raise ValidationError("Invalid free-form bounds.")


def normalize_global_fonts(document):
    """Accept legacy font settings while keeping all new stored families global."""
    import copy
    validate_document(document)
    result = copy.deepcopy(document)
    def visit(node):
        node.get('style', {}).pop('fontFamily', None)
        for style in node.get('responsive', {}).values():
            style.pop('fontFamily', None)
        for child in node['children']:
            visit(child)
    visit(result)
    return result


def template_document(value):
    document = normalize_global_fonts(value)
    node_keys = {'id', 'type', 'props', 'children', 'style', 'responsive'}
    page_keys = node_keys | {'schemaVersion', 'title', 'mode', 'theme', 'context', 'motionDisabled', 'seo', 'analytics'}
    def visit(node):
        if set(node) - (page_keys if node is document else node_keys):
            raise ValidationError('Unsupported template document field.')
        for child in node['children']:
            visit(child)
    visit(document)
    if set(document['theme']) - {'name', 'colors', 'headingFont', 'bodyFont', 'baseSize', 'scale', 'radius'}:
        raise ValidationError('Unsupported template theme field.')
    document.pop('context', None)
    document.pop('analytics', None)
    return document


def validate_page_settings(seo):
    if seo is None: return
    bounds = {'title': 180, 'description': 500, 'socialTitle': 180, 'socialDescription': 500, 'socialImage': 160, 'canonical': 3000}
    if not isinstance(seo, dict) or set(seo) - (set(bounds) | {'noIndex'}): raise ValidationError('Invalid page settings.')
    for key, maximum in bounds.items():
        if key in seo and (not isinstance(seo[key], str) or len(seo[key]) > maximum): raise ValidationError('Invalid page setting.')
    canonical = seo.get('canonical', '')
    if canonical:
        from urllib.parse import urlsplit
        try:
            url = urlsplit(canonical)
            if url.scheme not in {'http', 'https'} or not url.netloc or re.search(r'[\x00-\x20\x7f\\]', canonical): raise ValueError()
        except ValueError: raise ValidationError('Use a complete HTTP or HTTPS canonical URL.')
    if 'noIndex' in seo and type(seo['noIndex']) is not bool: raise ValidationError('Invalid indexing choice.')


def validate_content_props(kind, props):
    items = props.get('items')
    if 'items' in props or kind in {'accordion', 'tabs'}:
        if kind not in {'accordion', 'tabs'} or not isinstance(items, list) or not 1 <= len(items) <= 20: raise ValidationError('Use 1–20 content items.')
        for item in items:
            if not isinstance(item, dict) or set(item) != {'title', 'body'} or not isinstance(item['title'], str) or (not item['title'].strip() or len(item['title']) > 160) or not isinstance(item['body'], str) or len(item['body']) > 12000: raise ValidationError('Use a title and plain text content.')
    for key, values in {'fit': ['cover', 'contain'], 'aspect': ['auto', '1/1', '4/3', '3/4', '16/9', '4/5', '3/2'], 'decorative': [0, 1]}.items():
        if key in props and (isinstance(props[key], bool) or props[key] not in values): raise ValidationError('Invalid media choice.')
    for key in ['focalX', 'focalY']:
        if key in props and (not isinstance(props[key], (int, float)) or isinstance(props[key], bool) or not math.isfinite(props[key]) or not 0 <= props[key] <= 100): raise ValidationError('Invalid focal point.')

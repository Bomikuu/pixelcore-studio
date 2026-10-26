"""Raster validation and synchronous, bounded WebP renditions; persistence stays host-owned."""
from io import BytesIO
import warnings
from uuid import uuid4
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD = 8 * 1024 * 1024
MAX_PIXELS = 20_000_000


def prepare_image(upload):
    if upload is None or upload.size > MAX_UPLOAD:
        raise ValidationError('Choose a JPEG, PNG or WebP image smaller than 8 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            image = Image.open(upload)
            if image.format not in {'JPEG', 'PNG', 'WEBP'} or image.width * image.height > MAX_PIXELS or getattr(image, 'is_animated', False):
                raise ValidationError('Use a still JPEG, PNG or WebP image up to 20 megapixels.')
            image.verify()
            upload.seek(0)
            image = ImageOps.exif_transpose(Image.open(upload))
            image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
            image.thumbnail((2400, 2400), Image.Resampling.LANCZOS)
            def encode(value):
                output = BytesIO(); value.save(output, 'WEBP', quality=85, method=4)
                return output.getvalue()
            result = {'width': image.width, 'height': image.height, 'content': encode(image), 'renditions': []}
            for width in (640, 1280):
                if width >= image.width: continue
                small = image.copy(); small.thumbnail((width, 2400), Image.Resampling.LANCZOS)
                result['renditions'].append({'width': small.width, 'height': small.height, 'content': encode(small)})
            return result
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValidationError('This image cannot be read. Choose a valid JPEG, PNG or WebP file.') from error


def persist_image(prepared, storage, prefix):
    saved = []
    try:
        key = uuid4().hex
        main = storage.save(f'{prefix}/{key}.webp', ContentFile(prepared['content'])); saved.append(main)
        renditions = []
        for rendition in prepared['renditions']:
            name = storage.save(f'{prefix}/{key}-{rendition["width"]}.webp', ContentFile(rendition['content'])); saved.append(name)
            renditions.append({'name': name, 'width': rendition['width'], 'height': rendition['height']})
        return {'name': main, 'width': prepared['width'], 'height': prepared['height'], 'renditions': renditions, 'size': len(prepared['content'])}
    except Exception:
        for name in saved: storage.delete(name)
        raise

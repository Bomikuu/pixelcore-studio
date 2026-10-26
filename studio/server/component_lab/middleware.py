from django.http import JsonResponse

class UploadLimitMiddleware:
    """Reject oversized multipart bodies before CSRF or upload handlers spool files."""
    def __init__(self, get_response): self.get_response = get_response
    def __call__(self, request):
        if request.path.startswith('/api/studio/'):
            try: length = int(request.META.get('CONTENT_LENGTH') or 0)
            except ValueError: length = 24_000_001
            if length > 24_000_000:
                return JsonResponse({'error': {'message': 'Upload a package under 20 MB.'}}, status=413)
        return self.get_response(request)

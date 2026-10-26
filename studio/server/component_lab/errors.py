class PlatformResponseError(Exception):
    def __init__(self, status, value):
        self.status=status
        self.value=value

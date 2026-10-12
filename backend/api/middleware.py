from storage import clients


class ClientMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers") or [])
            clients.set_current(headers.get(b"x-client-id", b"").decode() or None)
        await self.app(scope, receive, send)

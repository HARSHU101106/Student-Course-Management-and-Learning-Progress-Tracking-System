"""Service-to-service authentication: the Express API presents a shared bearer token."""
import hmac

from fastapi import Header, HTTPException, Request, status


def verify_service_token(request: Request, authorization: str | None = Header(default=None)) -> None:
    expected = request.app.state.deps.settings.ai_service_token
    if not expected:
        # Only reachable outside production (Settings enforces a token there); refuse rather than run open.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI_SERVICE_TOKEN is not configured")
    scheme, _, supplied = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(supplied.strip().encode(), expected.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid service token", headers={"WWW-Authenticate": "Bearer"})

from fastapi import APIRouter, Request

from ..schemas.models import OutlineRequest, OutlineResponse

router = APIRouter(prefix="/v1/studio", tags=["studio"])


@router.post("/outline", response_model=OutlineResponse)
async def outline(body: OutlineRequest, request: Request) -> OutlineResponse:
    state = await request.app.state.graphs["studio"].ainvoke({"items": [item.model_dump() for item in body.items]})
    return OutlineResponse(**state["outline"])

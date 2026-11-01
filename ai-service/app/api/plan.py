from fastapi import APIRouter, Request

from ..schemas.models import PlanItem, PlanRequest, PlanResponse

router = APIRouter(prefix="/v1/plan", tags=["plan"])


@router.post("", response_model=PlanResponse)
async def plan(body: PlanRequest, request: Request) -> PlanResponse:
    state = await request.app.state.graphs["planner"].ainvoke({"request": body.model_dump()})
    return PlanResponse(
        items=[PlanItem(**item) for item in state["items"]],
        summary=state["summary"],
        generatedBy=state["generated_by"],
    )

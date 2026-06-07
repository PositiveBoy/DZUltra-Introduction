from fastapi import APIRouter, HTTPException

from app.models.schemas import AgentTrace, TraceSummary
from app.traces.store import trace_store

router = APIRouter(prefix="/traces", tags=["traces"])


@router.get("", response_model=list[TraceSummary])
def list_traces() -> list[TraceSummary]:
    return trace_store.list_summaries()


@router.get("/{trace_id}", response_model=AgentTrace)
def get_trace(trace_id: str) -> AgentTrace:
    trace = trace_store.get(trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace

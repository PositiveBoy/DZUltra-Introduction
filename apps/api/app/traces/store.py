from __future__ import annotations

from app.models.schemas import AgentTrace, TraceSummary


class TraceStore:
    def __init__(self) -> None:
        self._traces: dict[str, AgentTrace] = {}

    def save(self, trace: AgentTrace) -> AgentTrace:
        self._traces[trace.id] = trace
        return trace

    def list(self) -> list[AgentTrace]:
        return list(self._traces.values())

    def list_summaries(self) -> list[TraceSummary]:
        traces = sorted(self._traces.values(), key=lambda trace: trace.id, reverse=True)
        return [
            TraceSummary(
                id=trace.id,
                user_goal=trace.user_goal,
                status=trace.status,
                total_duration_ms=trace.total_duration_ms,
                route_score=trace.route_score,
                runner_mode=trace.runner_mode,
                event_count=len(trace.events),
                selected_plan_id=trace.metadata.get("selected_plan_id"),
            )
            for trace in traces
        ]

    def get(self, trace_id: str) -> AgentTrace | None:
        return self._traces.get(trace_id)


trace_store = TraceStore()

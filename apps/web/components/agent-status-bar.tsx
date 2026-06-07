"use client";

import { useDemoStore } from "@/stores/use-demo-store";

const agentSteps = [
  { id: "InteractionRouterAgent", short: "Router" },
  { id: "ConstraintDiscoveryAgent", short: "Discovery" },
  { id: "UserPreferenceAgent", short: "Preference" },
  { id: "ContextGroundingAgent", short: "Grounding" },
  { id: "PlanSolverAgent", short: "Solver" },
  { id: "PlanEvaluatorAgent", short: "Evaluator" },
  { id: "PlanExplanationAgent", short: "Explanation" },
];

type StepStatus = "completed" | "running" | "pending" | "failed";

function getAgentStatus(agentId: string, activeStep: string | null, events: { agent?: string; type: string }[]): StepStatus {
  if (!events.length && !activeStep) return "pending";

  const agentEvents = events.filter((e) => e.agent === agentId);
  const hasCompleted = agentEvents.some((e) =>
    ["run_completed", "handoff", "route_scored", "route_candidate_generated", "chat_answered", "requirements_summarized", "constraint_checked"].includes(e.type)
  );
  const hasStarted = agentEvents.some((e) => ["agent_started", "tool_called"].includes(e.type));

  if (hasCompleted) return "completed";
  if (activeStep === agentId || hasStarted) return "running";

  const activeIndex = agentSteps.findIndex((n) => n.id === activeStep);
  const nodeIndex = agentSteps.findIndex((n) => n.id === agentId);
  if (activeIndex >= 0 && nodeIndex < activeIndex) return "completed";

  return "pending";
}

function getTotalElapsedMs(events: { duration_ms?: number; durationMs?: number }[]): number {
  return events.reduce((sum, e) => sum + (e.duration_ms ?? e.durationMs ?? 0), 0);
}

export function AgentStatusBar() {
  const { activeTrace, activeAgentStep, providerStatuses, setSelectedTraceEventId } = useDemoStore();
  const events = activeTrace?.events ?? [];
  const totalMs = getTotalElapsedMs(events);
  const totalSec = (totalMs / 1000).toFixed(1);
  const budgetSec = 10;
  const ratio = Math.min(totalMs / (budgetSec * 1000), 1);

  return (
    <div className="flex h-11 items-center gap-4 border-b border-dz-line bg-white/60 px-4 text-xs">
      {/* Agent 进度 */}
      <div className="flex items-center gap-1.5">
        {agentSteps.map((step, i) => {
          const status = getAgentStatus(step.id, activeAgentStep, events);
          return (
            <button
              key={step.id}
              onClick={() => {
                const event = events.find((e) => e.agent === step.id);
                if (event) setSelectedTraceEventId(event.id);
              }}
              className="flex items-center gap-1 transition-colors"
              title={step.id}
            >
              {i > 0 && <span className="text-neutral-300">›</span>}
              <span
                className={`
                  inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium transition-all
                  ${status === "running"
                    ? "bg-blue-100 text-blue-700"
                    : status === "completed"
                      ? "bg-green-100 text-green-700"
                      : "bg-neutral-100 text-neutral-400"
                  }
                `}
              >
                <span
                  className={`
                    inline-block h-1.5 w-1.5 rounded-full
                    ${status === "running" ? "animate-pulse bg-blue-500" : status === "completed" ? "bg-green-500" : "bg-neutral-300"}
                  `}
                />
                {step.short}
              </span>
            </button>
          );
        })}
      </div>

      {/* 分隔线 */}
      <div className="h-4 w-px bg-neutral-200" />

      {/* Provider 状态灯 */}
      <div className="flex items-center gap-2">
        {providerStatuses.map((p) => (
          <span key={p.name} className="inline-flex items-center gap-1" title={`${p.label}: ${p.status === "connected" ? "已接入" : p.status === "mock" ? "Mock降级" : "超时"}`}>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                p.status === "connected" ? "bg-green-500" : p.status === "mock" ? "bg-yellow-500" : "bg-red-500"
              }`}
            />
            <span className="text-[10px] text-neutral-500">{p.name}</span>
          </span>
        ))}
      </div>

      {/* 分隔线 */}
      <div className="h-4 w-px bg-neutral-200" />

      {/* 耗时 */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              ratio < 0.7 ? "bg-green-500" : ratio < 0.9 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <span className="font-mono text-[11px] text-neutral-500">
          {events.length ? `${totalSec}s` : "—"}<span className="text-neutral-300">/{budgetSec}s</span>
        </span>
      </div>
    </div>
  );
}

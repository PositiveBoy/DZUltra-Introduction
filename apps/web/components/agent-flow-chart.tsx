"use client";

import { useDemoStore } from "@/stores/use-demo-store";

const agentNodes = [
  { id: "InteractionRouterAgent", short: "Router" },
  { id: "ConstraintDiscoveryAgent", short: "Discovery" },
  { id: "UserPreferenceAgent", short: "Preference", async: true },
  { id: "ContextGroundingAgent", short: "Grounding" },
  { id: "PlanSolverAgent", short: "Solver" },
  { id: "PlanEvaluatorAgent", short: "Evaluator" },
  { id: "PlanExplanationAgent", short: "Explanation" },
];

const providerIcons = [
  { name: "amap", label: "地图" },
  { name: "caiyun", label: "天气" },
  { name: "mock_queue", label: "排队" },
];

type StepStatus = "completed" | "running" | "pending" | "failed";

function getStepStatus(agentId: string, activeStep: string | null, traceEvents: { agent?: string; type: string }[]): StepStatus {
  if (!traceEvents.length && !activeStep) return "pending";

  const agentEvents = traceEvents.filter((e) => e.agent === agentId);
  const hasCompleted = agentEvents.some((e) => e.type === "run_completed" || e.type === "handoff" || e.type === "route_scored" || e.type === "route_candidate_generated");
  const hasStarted = agentEvents.some((e) => e.type === "agent_started" || e.type === "tool_called");

  if (hasCompleted) return "completed";
  if (activeStep === agentId || hasStarted) return "running";

  // Determine order-based status
  const activeIndex = agentNodes.findIndex((n) => n.id === activeStep);
  const nodeIndex = agentNodes.findIndex((n) => n.id === agentId);
  if (activeIndex >= 0 && nodeIndex < activeIndex) return "completed";

  return "pending";
}

export function AgentFlowChart() {
  const { activeTrace, activeAgentStep } = useDemoStore();
  const events = activeTrace?.events ?? [];

  return (
    <div className="rounded-lg border border-dz-line bg-white/60 p-4">
      <h3 className="mb-3 text-xs font-bold text-neutral-600">Agent 执行流程</h3>

      {/* Agent 节点 */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {agentNodes.map((node, i) => {
          const status = getStepStatus(node.id, activeAgentStep, events);
          return (
            <div key={node.id} className="flex items-center gap-1">
              <div
                className={`
                  flex flex-col items-center rounded-md border px-2 py-1.5 text-center transition-all duration-300
                  ${status === "running"
                    ? "border-blue-400 bg-blue-50 shadow-sm shadow-blue-200"
                    : status === "completed"
                      ? "border-green-300 bg-green-50"
                      : "border-neutral-200 bg-neutral-50/50"
                  }
                  ${node.async ? "border-dashed" : ""}
                `}
              >
                <span className={`text-[10px] font-semibold ${
                  status === "running" ? "text-blue-600" : status === "completed" ? "text-green-600" : "text-neutral-400"
                }`}>
                  {node.short}
                </span>
                {status === "running" && (
                  <span className="mt-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                )}
                {status === "completed" && (
                  <span className="mt-0.5 text-[10px] text-green-500">✓</span>
                )}
              </div>
              {i < agentNodes.length - 1 && (
                <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0 text-neutral-300">
                  <path d="M2 6h7M7 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Provider 图标 */}
      <div className="mt-2 flex items-center gap-3 border-t border-dz-line pt-2">
        <span className="text-[10px] text-neutral-400">Providers:</span>
        {providerIcons.map((p) => (
          <span key={p.name} className="text-[10px] text-neutral-500">
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

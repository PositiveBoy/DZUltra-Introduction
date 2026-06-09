from typing import Any, Literal

from pydantic import BaseModel, Field


PoiCategory = Literal["food", "culture", "entertainment", "dessert", "shopping"]
PreferenceCategory = Literal["taste", "budget", "mobility", "scenario", "experience", "avoidance"]
TraceEventType = Literal[
    "run_started",
    "agent_started",
    "constraint_discovered",
    "context_collected",
    "context_grounded",
    "tool_called",
    "handoff",
    "clarification_requested",
    "requirements_summarized",
    "preference_detected",
    "candidate_retrieved",
    "map_context_resolved",
    "constraint_checked",
    "route_candidate_generated",
    "route_scored",
    "chat_answered",
    "user_refinement_received",
    "task_switched",
    "llm_chunk",
    "run_completed",
    "run_failed",
]
InteractionType = Literal[
    "new_planning_task",
    "chat_answer",
    "answer_clarification",
    "confirm_requirements",
    "refine_current_plan",
    "select_plan",
    "switch_task",
]
IntentKind = Literal["planning", "refinement_without_context", "non_planning", "ambiguous"]
PlanningStatus = Literal[
    "ready",
    "needs_clarification",
    "needs_confirmation",
    "input_not_plannable",
    "completed",
]
MapProviderName = Literal["mock_map_provider", "amap"]
CoordinateConfidence = Literal["verified", "mocked", "missing"]
TransportMode = Literal["walk", "bike", "taxi", "metro"]
ConstraintCategory = Literal[
    "goal",
    "time",
    "location",
    "people",
    "food",
    "budget",
    "mobility",
    "weather",
    "traffic",
    "poi",
    "ugc",
    "preference",
    "system",
]
ConstraintHardness = Literal["hard", "soft"]
ConstraintSource = Literal[
    "user_explicit",
    "user_implicit",
    "historical_preference",
    "weather_provider",
    "traffic_provider",
    "map_provider",
    "poi_provider",
    "ugc_provider",
    "queue_provider",
    "system_default",
    "llm_inference",
]
ConstraintReliability = Literal["verified", "generated_validated", "mocked", "predicted", "inferred", "missing"]
ConstraintStatus = Literal[
    "discovered",
    "needs_clarification",
    "assumed",
    "grounded",
    "satisfied",
    "violated",
    "not_applicable",
]
ConstraintImpact = Literal["filter", "boost", "penalty", "warning", "clarify", "explain"]
AgentRuntimeRole = Literal["main_planning", "auxiliary", "background"]
GraphNodeKind = Literal["agent", "condition", "wait", "terminal"]
ProviderCategory = Literal["map", "weather", "llm"]


MockUserType = Literal["new", "regular"]
RunnerMode = Literal["real_agent_ai_generated_data", "deterministic_mock", "openai_agents_sdk"]
GeneratedDataOrigin = Literal["ai_generated_dataset", "fallback_template", "provider_api", "user_input"]
GeneratedDataReliability = Literal["verified", "generated_validated", "fallback_template", "missing"]


class MockUser(BaseModel):
    id: str
    name: str
    user_type: MockUserType = "regular"
    city: str | None = None
    scenario: str
    age: int | None = Field(default=None, ge=0)
    gender: str | None = None
    occupation: str | None = None
    lifestyle_tags: list[str] = Field(default_factory=list)
    home_area: str | None = None
    work_area: str | None = None
    frequent_areas: list[str] = Field(default_factory=list)
    current_location: dict[str, Any] | None = None
    default_goal: str | None = None
    group_size: int | None = None
    time_window: str | None = None
    budget_per_person: int | None = None
    transport_preference: str | None = None
    preferences: list[str] = Field(default_factory=list)
    avoidances: list[str] = Field(default_factory=list)
    priority_weights: dict[str, float] = Field(default_factory=dict)
    explain_focus: list[str] = Field(default_factory=list)
    saved_pois: list[dict[str, Any]] = Field(default_factory=list)
    viewed_pois: list[dict[str, Any]] = Field(default_factory=list)
    rated_pois: list[dict[str, Any]] = Field(default_factory=list)
    ugc_reviews: list[dict[str, Any]] = Field(default_factory=list)
    history_summary: str | None = None
    data_origin: GeneratedDataOrigin = "ai_generated_dataset"
    provider_name: str = "ai_generated_dataset"
    generated_by: str | None = "MockDataAgent"
    schema_version: str = "v3-ai-generated-user-001"
    data_reliability: GeneratedDataReliability = "generated_validated"


class RecommendedDish(BaseModel):
    """推荐菜/大家都在点 - V3 使用本地 Mock 数据"""
    name: str
    image: str | None = None
    price: float | None = None
    recommend_count: int | None = None
    tags: list[str] = Field(default_factory=list)


class StructuredOpenHours(BaseModel):
    """结构化营业时间 - 由高德 POI 营业时间原文经 LLM 解析生成"""
    periods: list[dict[str, Any]] = Field(default_factory=list)
    timezone: str = "Asia/Shanghai"
    raw_text: str | None = None


class MockPoi(BaseModel):
    id: str
    name: str
    category: PoiCategory
    source: str = "ai_generated_dataset"
    reliability: dict[str, str] = Field(default_factory=dict)
    field_reliability: dict[str, ConstraintReliability] = Field(default_factory=dict)
    enrichment_reliability: dict[str, ConstraintReliability] = Field(default_factory=dict)
    city: str | None = None
    district: str | None = None
    area: str
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    rating: float
    review_count: int | None = None
    queue_minutes: int
    tags: list[str] = Field(default_factory=list)
    avg_price: int | None = None
    open_hours: str | None = None
    structured_open_hours: StructuredOpenHours | None = None
    business_status: str | None = None
    visit_duration_minutes: int | None = None
    ugc_summary: str | None = None
    ugc_highlights: list[dict[str, Any]] = Field(default_factory=list)
    platform_badges: list[str] = Field(default_factory=list)
    service_options: list[str] = Field(default_factory=list)
    deal_summary: str | None = None
    booking_hint: str | None = None
    booking_required: bool = False
    advance_booking_hours: int = Field(default=0, ge=0)
    purchasable_until_minutes_before: int | None = Field(default=None, ge=0)
    decision_signals: dict[str, str] = Field(default_factory=dict)
    risk_notes: list[str] = Field(default_factory=list)
    telephone: str | None = None
    images: list[str] = Field(default_factory=list)
    recommended_dishes: list[RecommendedDish] = Field(default_factory=list)
    taste_rating: float | None = None
    environment_rating: float | None = None
    service_rating: float | None = None
    data_origin: GeneratedDataOrigin = "ai_generated_dataset"
    provider_name: str = "ai_generated_dataset"
    generated_by: str | None = "MockDataAgent"
    schema_version: str = "v3-ai-generated-poi-001"
    data_reliability: GeneratedDataReliability = "generated_validated"


class AgentStrategy(BaseModel):
    name: str
    responsibility: str
    inputs: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    handoff_conditions: list[str] = Field(default_factory=list)
    failure_fallback: str
    trace_events: list[TraceEventType] = Field(default_factory=list)
    runtime_role: AgentRuntimeRole = "main_planning"
    llm_call_budget: int = Field(default=0, ge=0)
    react_step_budget: int = Field(default=0, ge=0)
    latency_budget_ms: int | None = None
    parallelizable: bool = False


class ConstraintEvidence(BaseModel):
    source: ConstraintSource
    summary: str
    raw_ref: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class PlanningConstraint(BaseModel):
    id: str
    label: str
    description: str
    category: ConstraintCategory
    hardness: ConstraintHardness
    source: ConstraintSource
    reliability: ConstraintReliability
    status: ConstraintStatus = "discovered"
    impact: list[ConstraintImpact] = Field(default_factory=list)
    weight: float = Field(default=1.0, ge=0, le=1)
    evidence: list[ConstraintEvidence] = Field(default_factory=list)
    requires_grounding: bool = False
    requires_clarification: bool = False
    applies_to: list[str] = Field(default_factory=list)


class ConstraintLedger(BaseModel):
    version: str = "v3-constraint-ledger-001"
    run_id: str | None = None
    user_goal: str
    constraints: list[PlanningConstraint] = Field(default_factory=list)
    missing_required_fields: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    soft_constraint_suggestions: list[PlanningConstraint] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class AgentPromptContract(BaseModel):
    agent_name: str
    objective: str
    input_schema: str
    output_schema: str
    tools: list[str] = Field(default_factory=list)
    max_llm_calls: int = Field(default=0, ge=0)
    max_react_steps: int = Field(default=0, ge=0)
    latency_budget_ms: int | None = None
    guardrails: list[str] = Field(default_factory=list)
    fallback: str


class LangGraphNodeContract(BaseModel):
    id: str
    agent_name: str | None = None
    kind: GraphNodeKind
    reads: list[str] = Field(default_factory=list)
    writes: list[str] = Field(default_factory=list)
    description: str


class LangGraphEdgeContract(BaseModel):
    source: str
    target: str
    condition: str = "always"
    description: str


class LangGraphWorkflowContract(BaseModel):
    name: str
    state_schema: list[str] = Field(default_factory=list)
    nodes: list[LangGraphNodeContract] = Field(default_factory=list)
    edges: list[LangGraphEdgeContract] = Field(default_factory=list)
    retry_policy: dict[str, Any] = Field(default_factory=dict)
    latency_budget_ms: int | None = None


class RouteConstraint(BaseModel):
    key: str
    label: str
    satisfied: bool
    detail: str


class GeoCoordinate(BaseModel):
    latitude: float
    longitude: float


class MapLocation(BaseModel):
    id: str | None = None
    name: str | None = None
    city: str | None = None
    area: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class PoiAction(BaseModel):
    id: str
    label: str
    kind: Literal["navigate", "queue", "deal", "ticket", "book"]
    disabled: bool = False


class RouteStop(BaseModel):
    poi_id: str
    poi_name: str
    start_time: str
    duration_minutes: int
    reason: str
    category: PoiCategory | None = None
    area: str | None = None
    rating: float | None = None
    avg_price: int | None = None
    queue_minutes: int | None = None
    tags: list[str] = Field(default_factory=list)
    ugc_summary: str | None = None
    distance_from_previous: str | None = None
    actions: list[PoiAction] = Field(default_factory=list)


class MapPoint(BaseModel):
    x: int = Field(ge=0, le=100)
    y: int = Field(ge=0, le=100)
    label: str


class MapPreviewPoint(BaseModel):
    id: str
    name: str
    label: str
    sequence_index: int
    coordinate: GeoCoordinate | None = None
    coordinate_confidence: CoordinateConfidence = "verified"
    area: str | None = None
    address: str | None = None


class RouteMatrixLeg(BaseModel):
    origin_id: str
    destination_id: str
    mode: TransportMode = "taxi"
    distance_meters: int
    duration_minutes: int
    provider: MapProviderName = "mock_map_provider"
    polyline: list[GeoCoordinate] = Field(default_factory=list)


class MapPreview(BaseModel):
    provider: MapProviderName = "mock_map_provider"
    preview_type: Literal["mock_vector", "mock_png", "amap_static"] = "mock_vector"
    fallback_used: bool = False
    coordinate_confidence: CoordinateConfidence = "verified"
    center: GeoCoordinate | None = None
    points: list[MapPreviewPoint] = Field(default_factory=list)
    visual_points: list[MapPoint] = Field(default_factory=list)
    route_segments: list[RouteMatrixLeg] = Field(default_factory=list)
    total_distance_meters: int = 0
    total_duration_minutes: int = 0
    static_image_url: str | None = None
    note: str | None = None


class TransportOption(BaseModel):
    mode: TransportMode
    label: str
    minutes: int
    cost: str
    detail: str


class TodoItem(BaseModel):
    id: str
    label: str
    done: bool = False
    stop_poi_id: str | None = None
    action_label: str | None = None
    action_kind: Literal["navigate", "queue", "deal", "ticket", "book", "share"] | None = None
    action_references: list[dict[str, Any]] = Field(default_factory=list)
    constraints: list[dict[str, Any]] = Field(default_factory=list)


class RoutePlan(BaseModel):
    id: str
    title: str
    subtitle: str | None = None
    theme: str | None = None
    badge: str | None = None
    score: int = Field(ge=0, le=100)
    total_minutes: int
    highlights: list[str] = Field(default_factory=list)
    map_points: list[MapPoint] = Field(default_factory=list)
    map_preview: MapPreview | None = None
    transport_summary: str | dict[str, Any] | None = None
    transports: list[TransportOption] = Field(default_factory=list)
    stops: list[RouteStop] = Field(default_factory=list)
    constraints: list[RouteConstraint] = Field(default_factory=list)
    todo_items: list[TodoItem] = Field(default_factory=list)
    rank_reason: str | None = None
    score_breakdown: dict[str, Any] = Field(default_factory=dict)


class ClarificationCard(BaseModel):
    id: str
    type: Literal["clarification_card"] = "clarification_card"
    question: str
    field: str
    selection_mode: Literal["single", "multiple", "free_text"] = "single"
    ui_component: Literal[
        "choice_buttons",
        "number_picker",
        "time_range_picker",
        "budget_picker",
        "free_text",
    ] = "choice_buttons"
    options: list[str] = Field(default_factory=list)
    default_value: str | None = None
    allow_other: bool = True
    round_index: int = Field(default=1, ge=1, le=2)
    blocks_planning: bool = False
    required: bool = False
    allow_skip: bool = True
    reason: str


class RequirementSummary(BaseModel):
    status: PlanningStatus
    intent_kind: IntentKind
    can_plan: bool
    collected: dict[str, Any] = Field(default_factory=dict)
    missing_required_fields: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    user_visible_summary: list[str] = Field(default_factory=list)
    next_action: str


class ConstraintDiscoveryLlmOutput(BaseModel):
    """Pydantic schema for validating LongCat ConstraintDiscoveryAgent output."""

    requirement_summary: RequirementSummary
    clarification_cards: list[ClarificationCard] = Field(default_factory=list)
    constraint_ledger_patch: list[PlanningConstraint] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    grounding_requests: list[str] = Field(
        default_factory=list,
        description="List of fact categories that need provider grounding, e.g. weather, poi_search, route_matrix.",
    )


class UserPreference(BaseModel):
    id: str
    label: str
    category: PreferenceCategory
    source: str
    source_prompt: str | None = None
    confidence: float = Field(default=0.82, ge=0, le=1)
    created_at: str
    updated_at: str


class UserPreferenceProfile(BaseModel):
    user_id: str
    preferences: list[UserPreference] = Field(default_factory=list)


class PreferenceDetectionRequest(BaseModel):
    user_id: str
    utterance: str
    source_trace_id: str | None = None


class PreferenceDetectionResponse(BaseModel):
    user_id: str
    detected_preferences: list[UserPreference] = Field(default_factory=list)
    profile: UserPreferenceProfile
    skipped_reason: str | None = None


class PreferenceUpdateRequest(BaseModel):
    label: str


class RefinementIntent(BaseModel):
    """LLM 解析出的微调意图结构。"""
    type: Literal["local_replace", "local_reorder", "partial_keep", "full_rerun"]
    target_stop_indices: list[int] = Field(default_factory=list)
    target_categories: list[str] = Field(default_factory=list)
    keep_stop_indices: list[int] = Field(default_factory=list)
    reason: str = ""
    confidence: float = 0.0


class RefinementChange(BaseModel):
    type: Literal["kept", "replaced", "reordered", "updated_copy"]
    stop_index: int | None = None
    before_poi_id: str | None = None
    after_poi_id: str | None = None
    reason: str


class RefinementDiff(BaseModel):
    instruction: str
    base_trace_id: str
    base_route_id: str
    strategy: Literal["local_replace", "local_reorder", "partial_keep", "full_rerun", "copy_update"]
    changes: list[RefinementChange] = Field(default_factory=list)
    refinement_intent: RefinementIntent | None = None


class GenerationMetadata(BaseModel):
    runner_mode: RunnerMode = "real_agent_ai_generated_data"
    fallback_used: bool = False
    selected_plan_id: str | None = None
    plan_count: int = 1
    mock_generation_ready: bool = True
    planning_status: PlanningStatus = "completed"
    intent_kind: IntentKind = "planning"
    interaction_type: InteractionType = "new_planning_task"
    clarification_card_count: int = 0
    simulated_total_duration_ms: int | None = None


class TraceEvent(BaseModel):
    id: str
    type: TraceEventType
    label: str
    summary: str
    agent: str | None = None
    duration_ms: int | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    tool_name: str | None = None
    tool_input: dict[str, Any] = Field(default_factory=dict)
    tool_output: dict[str, Any] = Field(default_factory=dict)
    handoff_from: str | None = None
    handoff_to: str | None = None
    fallback_used: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentTrace(BaseModel):
    id: str
    user_goal: str
    status: Literal["running", "completed", "failed"]
    total_duration_ms: int
    route_score: int | None = None
    events: list[TraceEvent] = Field(default_factory=list)
    runner_mode: RunnerMode = "real_agent_ai_generated_data"
    sdk_trace_id: str | None = None
    agent_strategy: list[AgentStrategy] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TraceSummary(BaseModel):
    id: str
    user_goal: str
    status: Literal["running", "completed", "failed"]
    total_duration_ms: int
    route_score: int | None = None
    runner_mode: RunnerMode = "real_agent_ai_generated_data"
    event_count: int
    selected_plan_id: str | None = None


class InteractionContext(BaseModel):
    page: str | None = None
    trace_id: str | None = None
    route_id: str | None = None
    selected_plan_id: str | None = None
    selected_stop_index: int | None = None
    pending_clarification_card_id: str | None = None
    current_run_status: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RoutePlanRequest(BaseModel):
    user_id: str
    goal: str
    city: str = "北京"
    constraints: list[str] = Field(default_factory=list)
    plan_mode: bool = True
    interaction_context: InteractionContext | None = None
    clarification_answers: dict[str, Any] = Field(default_factory=dict)
    skip_clarification: bool = False
    require_confirmation: bool = False
    confirmed_requirements: bool = False
    previous_trace_id: str | None = None
    preference_detection_enabled: bool = True


class RouteRefineRequest(BaseModel):
    trace_id: str
    route_id: str
    instruction: str


class InteractionRequest(BaseModel):
    user_id: str = "anonymous"
    message: str
    city: str = "北京"
    plan_mode: bool = True
    interaction_context: InteractionContext | None = None
    constraints: list[str] = Field(default_factory=list)
    clarification_answers: dict[str, Any] = Field(default_factory=dict)
    preference_detection_enabled: bool = True
    require_confirmation: bool = False
    confirmed_requirements: bool = False


class RoutePlanResponse(BaseModel):
    trace_id: str
    plan: RoutePlan
    trace: AgentTrace
    plans: list[RoutePlan] = Field(default_factory=list)
    selected_plan_id: str | None = None
    interaction_type: InteractionType = "new_planning_task"
    clarification_cards: list[ClarificationCard] = Field(default_factory=list)
    requirement_summary: RequirementSummary | None = None
    planning_status: PlanningStatus = "completed"
    refinement_diff: RefinementDiff | None = None
    generation_metadata: GenerationMetadata = Field(default_factory=GenerationMetadata)


class ChatRequest(BaseModel):
    user_id: str = "anonymous"
    message: str
    city: str = "北京"
    plan_mode: bool = True
    interaction_context: InteractionContext | None = None
    constraints: list[str] = Field(default_factory=list)
    related_poi_limit: int = Field(default=3, ge=1, le=6)


class ChatResponse(BaseModel):
    trace_id: str
    answer: str
    related_pois: list[MockPoi] = Field(default_factory=list)
    can_convert_to_plan: bool = True
    used_preferences: list[str] = Field(default_factory=list)
    interaction_type: InteractionType = "chat_answer"
    fallback_used: bool = False
    fallback_reason: str | None = None
    poi_provider: str = "mock_poi_search"
    answer_provider: str = "template"
    trace: AgentTrace


class InteractionRoutingResult(BaseModel):
    interaction_type: InteractionType
    intent_kind: IntentKind
    confidence: float = Field(default=0.82, ge=0, le=1)
    routing_reason: str
    needs_followup: bool = False


class InteractionResponse(BaseModel):
    interaction_type: InteractionType
    trace_id: str
    trace: AgentTrace
    routing: InteractionRoutingResult
    chat: ChatResponse | None = None
    route_plan: RoutePlanResponse | None = None
    refinement: RoutePlanResponse | None = None
    selection: dict[str, Any] = Field(default_factory=dict)


class GeocodeRequest(BaseModel):
    address: str | None = None
    city: str = "北京"
    poi_id: str | None = None
    name: str | None = None


class GeocodeResponse(BaseModel):
    provider: MapProviderName = "mock_map_provider"
    fallback_used: bool = False
    coordinate_confidence: CoordinateConfidence = "verified"
    location: MapLocation


class RouteMatrixRequest(BaseModel):
    locations: list[MapLocation] = Field(default_factory=list, min_length=2)
    mode: TransportMode = "taxi"


class RouteMatrixResponse(BaseModel):
    provider: MapProviderName = "mock_map_provider"
    fallback_used: bool = False
    mode: TransportMode = "taxi"
    legs: list[RouteMatrixLeg] = Field(default_factory=list)
    total_distance_meters: int = 0
    total_duration_minutes: int = 0


class StaticPreviewRequest(BaseModel):
    locations: list[MapLocation] = Field(default_factory=list, min_length=1)
    title: str | None = None
    mode: TransportMode = "taxi"


class StaticPreviewResponse(BaseModel):
    preview: MapPreview


class GenerateUserRequest(BaseModel):
    user_type: MockUserType = "regular"
    scenario: str = "一键生成点仔 Ultra 演示用户"
    city: str = "北京"
    area: str | None = None
    customization: str | None = None
    current_location: dict[str, Any] | None = None


class GeneratePoisRequest(BaseModel):
    city: str = "北京"
    area: str = "三里屯"
    theme: str | None = None
    customization: str | None = None
    count: int = Field(default=30, ge=3, le=30)


class GeneratedMockResponse(BaseModel):
    fallback_used: bool = True
    source: Literal["ai_generated_dataset", "fallback_template", "longcat", "openai_agents_sdk"] = "ai_generated_dataset"
    data_origin: GeneratedDataOrigin = "ai_generated_dataset"
    provider_name: str = "ai_generated_dataset"
    generated_by: str = "MockDataAgent"
    schema_version: str = "v3-ai-generated-dataset-001"
    reliability: GeneratedDataReliability = "generated_validated"
    metadata: dict[str, Any] = Field(default_factory=dict)
    users: list[MockUser] = Field(default_factory=list)
    pois: list[MockPoi] = Field(default_factory=list)
    locations: list[dict[str, Any]] = Field(default_factory=list)


class ProviderRuntimeStatus(BaseModel):
    category: ProviderCategory
    provider: str
    configured: bool
    active: bool
    fallback_provider: str | None = None
    required_env: list[str] = Field(default_factory=list)
    masked_key: str | None = None
    notes: str | None = None


class ProviderStatusResponse(BaseModel):
    stage: str = "v3"
    allow_mock_runner: bool = True
    providers: list[ProviderRuntimeStatus] = Field(default_factory=list)
    llm_base_url: str | None = None
    llm_model: str | None = None


class LlmSmokeTestRequest(BaseModel):
    message: str = "请用一句话确认 LongCat 已接入 DZUltra V3。"
    max_tokens: int = Field(default=80, ge=16, le=512)


class LlmSmokeTestResponse(BaseModel):
    provider: str
    model: str
    answer: str
    usage: dict[str, Any] = Field(default_factory=dict)


class WeatherSmokeTestRequest(BaseModel):
    longitude: float = 116.397128
    latitude: float = 39.916527


class WeatherSmokeTestResponse(BaseModel):
    provider: str
    location: dict[str, float]
    realtime: dict[str, Any] = Field(default_factory=dict)
    hourly_preview: dict[str, Any] = Field(default_factory=dict)

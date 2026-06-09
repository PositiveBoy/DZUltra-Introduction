export type PoiCategory = "food" | "culture" | "entertainment" | "dessert" | "shopping";
export type MobileShellView =
  | "entry"
  | "searching"
  | "start"
  | "running"
  | "answering"
  | "clarifying"
  | "summary"
  | "plans"
  | "refining"
  | "selected"
  | "settings"
  | "error";

/** 内容块类型，与 USER_JOURNEY_DESIGN.md "内容块拆分口径"对齐 */
export type FlowBlockType =
  | "user_input"
  | "agent_chain"
  | "clarification"
  | "agent_reaction"
  | "summary"
  | "plans"
  | "selected"
  | "todo";

/** 纵向滚动容器中的一个内容块 */
export type FlowBlock = {
  id: string;
  type: FlowBlockType;
  timestamp: number;
};

export type InputMode = "text" | "voice";
export type TransportMode = "drive" | "taxi" | "transit" | "walk" | "metro" | "bike";

export type MockUser = {
  id: string;
  name: string;
  user_type?: "new" | "regular";
  scenario: string;
  preferences: string[];
  avoidances: string[];
};

// 后端 MockUser 完整字段；用于 AI Mock 生成器面板的展示与"应用到主链路"。
export type MockUserFull = {
  id: string;
  name: string;
  user_type?: "new" | "regular";
  city?: string;
  scenario: string;
  age?: number;
  gender?: string;
  occupation?: string;
  lifestyle_tags?: string[];
  home_area?: string;
  work_area?: string;
  frequent_areas?: string[];
  current_location?: Record<string, unknown>;
  default_goal?: string;
  group_size?: number;
  time_window?: string;
  budget_per_person?: number;
  transport_preference?: string;
  preferences: string[];
  avoidances: string[];
  priority_weights: Record<string, number>;
  explain_focus: string[];
  saved_pois?: Record<string, unknown>[];
  viewed_pois?: Record<string, unknown>[];
  rated_pois?: Record<string, unknown>[];
  ugc_reviews?: Record<string, unknown>[];
  history_summary?: string;
  data_origin?: "ai_generated_dataset" | "fallback_template" | "provider_api" | "user_input";
  provider_name?: string;
  generated_by?: string;
  schema_version?: string;
  data_reliability?: "verified" | "generated_validated" | "fallback_template" | "missing";
};

export type GenerateMockUserRequest = {
  user_type?: "new" | "regular";
  scenario?: string;
  city?: string;
  area?: string;
  customization?: string;
  current_location?: Record<string, unknown>;
};

export type GenerateMockPoisRequest = {
  city?: string;
  area?: string;
  theme?: string;
  customization?: string;
  count?: number;
};

export type MockLocation = {
  id: string;
  city: string;
  area?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  source: "manual" | "random" | "mock_generator" | "ai_generated_dataset";
  reliability: "user_input" | "mocked" | "generated_validated";
  label: string;
};

export type GeneratedMockResponse = {
  fallback_used: boolean;
  source: "ai_generated_dataset" | "fallback_template" | "longcat" | "openai_agents_sdk";
  data_origin?: "ai_generated_dataset" | "fallback_template" | "provider_api" | "user_input";
  provider_name?: string;
  generated_by?: string;
  schema_version?: string;
  reliability?: "verified" | "generated_validated" | "fallback_template" | "missing";
  metadata: Record<string, unknown>;
  users: MockUserFull[];
  pois: MockPoi[];
  locations?: MockLocation[];
};

export type RecommendedDish = {
  name: string;
  image?: string;
  price?: number;
  recommend_count?: number;
  tags?: string[];
};

export type StructuredOpenHours = {
  periods: Record<string, unknown>[];
  timezone?: string;
  raw_text?: string;
};

export type MockPoi = {
  id: string;
  name: string;
  category: PoiCategory;
  area: string;
  rating: number;
  queueMinutes: number;
  tags: string[];
  city?: string;
  district?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  reviewCount?: number;
  avgPrice?: number;
  openHours?: string;
  structuredOpenHours?: StructuredOpenHours;
  businessStatus?: string;
  visitDurationMinutes?: number;
  ugcSummary?: string;
  ugcHighlights?: Record<string, unknown>[];
  platformBadges?: string[];
  serviceOptions?: string[];
  dealSummary?: string;
  bookingHint?: string;
  bookingRequired?: boolean;
  advanceBookingHours?: number;
  decisionSignals?: Record<string, string>;
  riskNotes?: string[];
  telephone?: string;
  headPic?: string;
  images?: string[];
  recommendedDishes?: RecommendedDish[];
  tasteRating?: number;
  environmentRating?: number;
  serviceRating?: number;
  dataOrigin?: string;
  providerName?: string;
  generatedBy?: string;
  schemaVersion?: string;
  dataReliability?: string;
};

export type RouteStop = {
  poiId: string;
  poiName: string;
  startTime: string;
  durationMinutes: number;
  reason: string;
};

export type RoutePlan = {
  id: string;
  title: string;
  score: number;
  totalMinutes: number;
  highlights: string[];
  stops: RouteStop[];
};

export type MapPoint = {
  x: number;
  y: number;
  label: string;
};

export type TransportOption = {
  mode: TransportMode;
  label: string;
  minutes: number;
  cost: string;
  detail: string;
};

export type PoiAction = {
  id: string;
  label: string;
  kind: TodoActionKind;
  disabled?: boolean;
};

export type TodoActionKind = "navigate" | "queue" | "deal" | "ticket" | "book" | "share";

export type DemoPoiStop = RouteStop & {
  category: PoiCategory;
  area: string;
  address: string;
  rating: number;
  avgPrice?: number;
  queueMinutes: number;
  tags: string[];
  ugcSummary: string;
  tasteSummary?: string;
  envSummary?: string;
  images?: string[];
  headPic?: string;
  distanceFromPrevious: string;
  actions: PoiAction[];
  transportOptions?: TransportOption[];
  platformBadge?: string;
  platformBadges?: string[];
  tasteRating?: number;
  environmentRating?: number;
  serviceRating?: number;
  recommendedDishes?: string[];
  reviewCount?: number;
  positiveRate?: string;
};

export type DemoRoutePlan = Omit<RoutePlan, "stops"> & {
  subtitle: string;
  description?: string;
  theme: string;
  badge: string;
  mapTone: "orange" | "blue" | "green";
  mapPoints: MapPoint[];
  transports: TransportOption[];
  stops: DemoPoiStop[];
  todoItems: TodoItem[];
};

export type TodoItem = {
  id: string;
  stopPoiId: string;
  label: string;
  actionLabel: string;
  actionKind?: TodoActionKind;
  actionReferences: TodoActionReference[];
  constraints: TodoConstraint[];
};

export type TodoActionReference = {
  id: string;
  type: "deal" | "ticket" | "booking" | "share" | "poi";
  title: string;
  subtitle: string;
  imageUrl: string;
  price?: string;
  distance?: string;
  badge?: string;
  actionLabel: string;
  actionKind: TodoActionKind;
};

export type TodoConstraint = {
  id: string;
  label: string;
  detail: string;
  severity: "required" | "warning" | "info";
  satisfied: boolean;
};

export type ClarificationState = {
  people: number;
  timeRange: string;
  food: string;
  budget: string;
  taste: string;
};

export type InteractionType =
  | "new_planning_task"
  | "chat_answer"
  | "answer_clarification"
  | "confirm_requirements"
  | "refine_current_plan"
  | "select_plan"
  | "switch_task";

export type InteractionContext = {
  page?: string;
  trace_id?: string;
  route_id?: string;
  selected_plan_id?: string;
  selected_stop_index?: number;
  pending_clarification_card_id?: string;
  current_run_status?: string;
  metadata?: Record<string, unknown>;
};

export type IntentKind = "planning" | "non_planning" | "refinement_without_context" | "ambiguous";

export type InteractionRoutingResult = {
  interaction_type: InteractionType;
  intent_kind: IntentKind;
  confidence: number;
  routing_reason: string;
  needs_followup?: boolean;
};

export type InteractionRequestPayload = {
  user_id?: string;
  message: string;
  city?: string;
  plan_mode?: boolean;
  interaction_context?: InteractionContext;
  constraints?: string[];
  clarification_answers?: Record<string, unknown>;
  preference_detection_enabled?: boolean;
  require_confirmation?: boolean;
  confirmed_requirements?: boolean;
};

export type InteractionResponsePayload = {
  interaction_type: InteractionType;
  trace_id: string;
  trace: AgentTrace;
  routing: InteractionRoutingResult;
  chat?: ChatResponsePayload;
  route_plan?: RoutePlanResponsePayload;
  refinement?: RoutePlanResponsePayload;
  selection?: Record<string, unknown>;
};

export type RoutePlanRequestPayload = {
  client_request_id?: number;
  user_id: string;
  goal: string;
  city?: string;
  constraints?: string[];
  plan_mode?: boolean;
  interaction_context?: InteractionContext;
  clarification_answers?: Record<string, unknown>;
  skip_clarification?: boolean;
  require_confirmation?: boolean;
  confirmed_requirements?: boolean;
  previous_trace_id?: string;
  preference_detection_enabled?: boolean;
};

export type RouteRefineRequestPayload = {
  trace_id: string;
  route_id: string;
  instruction: string;
};

export type PlanningStatus =
  | "ready"
  | "needs_clarification"
  | "needs_confirmation"
  | "input_not_plannable"
  | "completed";

export type ClarificationCard = {
  id: string;
  type: "clarification_card";
  question: string;
  field: string;
  selection_mode: "single" | "multiple" | "free_text";
  ui_component?: "choice_buttons" | "number_picker" | "time_range_picker" | "budget_picker" | "free_text";
  options: string[];
  default_value?: string;
  allow_other?: boolean;
  round_index?: number;
  blocks_planning: boolean;
  required: boolean;
  allow_skip: boolean;
  reason: string;
};

export type RequirementSummary = {
  status: Exclude<PlanningStatus, "completed">;
  intent_kind: "planning" | "refinement_without_context" | "non_planning" | "ambiguous";
  can_plan: boolean;
  collected: Record<string, unknown>;
  missing_required_fields: string[];
  assumptions: string[];
  user_visible_summary: string[];
  next_action: string;
};

export type RoutePlanResponsePayload = {
  trace_id: string;
  plan: ApiRoutePlan;
  plans?: ApiRoutePlan[];
  selected_plan_id?: string;
  interaction_type?: InteractionType;
  planning_status?: PlanningStatus;
  clarification_cards?: ClarificationCard[];
  requirement_summary?: RequirementSummary;
  generation_metadata?: {
    runner_mode: "real_agent_ai_generated_data" | "deterministic_mock" | "openai_agents_sdk";
    fallback_used: boolean;
    selected_plan_id?: string;
    plan_count: number;
    planning_status: PlanningStatus;
    intent_kind: RequirementSummary["intent_kind"];
    interaction_type?: InteractionType;
    clarification_card_count: number;
    simulated_total_duration_ms?: number;
  };
  trace: AgentTrace;
  refinement_diff?: RefinementDiff;
};

export type ChatRequestPayload = {
  user_id?: string;
  message: string;
  city?: string;
  plan_mode?: boolean;
  interaction_context?: InteractionContext;
  constraints?: string[];
  related_poi_limit?: number;
};

export type ChatRelatedPoi = MockPoi & {
  queue_minutes?: number;
  avg_price?: number;
  ugc_summary?: string;
};

export type ChatResponsePayload = {
  trace_id: string;
  answer: string;
  related_pois: ChatRelatedPoi[];
  can_convert_to_plan: boolean;
  used_preferences: string[];
  interaction_type: "chat_answer";
  fallback_used?: boolean;
  fallback_reason?: string;
  poi_provider?: string;
  answer_provider?: string;
  trace: AgentTrace;
};

export type TraceEventType =
  | "run_started"
  | "agent_started"
  | "constraint_discovered"
  | "context_collected"
  | "context_grounded"
  | "tool_called"
  | "handoff"
  | "clarification_requested"
  | "requirements_summarized"
  | "preference_detected"
  | "candidate_retrieved"
  | "map_context_resolved"
  | "constraint_checked"
  | "route_candidate_generated"
  | "route_scored"
  | "chat_answered"
  | "user_refinement_received"
  | "task_switched"
  | "llm_chunk"
  | "run_completed"
  | "run_failed";

export type LlmChunkData = {
  type: "llm_chunk";
  content: string;
  purpose: string;
  model?: string;
  chunk_index?: number;
};

export type TokenUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

export type LlmRequestInfo = {
  messages?: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

export type LlmResponseInfo = {
  id?: string;
  choices?: Array<unknown>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  [key: string]: unknown;
};

export type TraceEventMetadata = {
  billing_mode?: "mock_estimate" | "actual";
  model_name?: string;
  model_duration_ms?: number;
  tool_duration_ms?: number;
  token_usage?: TokenUsage;
  estimated_cost_cny?: number;
  llm_request?: LlmRequestInfo;
  llm_response?: LlmResponseInfo;
  http_status_code?: number;
  http_response_body?: string;
  request_duration_ms?: number;
  streaming_tokens?: string;
} & Record<string, unknown>;

export type TraceEvent = {
  id: string;
  type: TraceEventType;
  label: string;
  agent?: string;
  durationMs?: number;
  duration_ms?: number;
  summary: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: Record<string, unknown>;
  handoff_from?: string;
  handoff_to?: string;
  fallback_used?: boolean;
  metadata?: TraceEventMetadata;
};

export type AgentTrace = {
  id: string;
  user_goal: string;
  status: "ready" | "running" | "completed" | "failed";
  total_duration_ms: number;
  route_score?: number;
  runner_mode?: "real_agent_ai_generated_data" | "deterministic_mock" | "openai_agents_sdk";
  agent_strategy?: AgentStrategy[];
  events: TraceEvent[];
  metadata?: Record<string, unknown>;
};

export type TraceSummary = {
  id: string;
  user_goal: string;
  status: "ready" | "running" | "completed" | "failed";
  total_duration_ms: number;
  route_score?: number;
  runner_mode?: "real_agent_ai_generated_data" | "deterministic_mock" | "openai_agents_sdk";
  event_count: number;
  selected_plan_id?: string;
};

export type AgentStrategy = {
  name: string;
  responsibility: string;
  inputs: string[];
  outputs: string[];
  tools: string[];
  handoff_conditions: string[];
  failure_fallback: string;
  trace_events: TraceEventType[];
  runtime_role?: "main_planning" | "auxiliary" | "background";
  llm_call_budget?: number;
  react_step_budget?: number;
  latency_budget_ms?: number;
  parallelizable?: boolean;
};

export type UserPreferenceCategory = "taste" | "budget" | "mobility" | "scenario" | "experience" | "avoidance";

export type UserPreference = {
  id: string;
  label: string;
  category?: UserPreferenceCategory;
  source: string;
  source_prompt?: string;
  confidence?: number;
  created_at?: string;
  updated_at?: string;
};

export type UserPreferenceProfile = {
  user_id: string;
  preferences: UserPreference[];
};

export type PreferenceDetectionResponse = {
  user_id: string;
  detected_preferences: UserPreference[];
  profile: UserPreferenceProfile;
  skipped_reason?: string;
};

export type ApiMapPoint = {
  x: number;
  y: number;
  label: string;
};

export type ApiGeoCoordinate = {
  latitude: number;
  longitude: number;
};

export type ApiMapPreviewPoint = {
  id: string;
  name: string;
  label: string;
  sequence_index: number;
  coordinate?: ApiGeoCoordinate;
  coordinate_confidence?: "verified" | "mocked" | "missing";
  area?: string;
  address?: string;
};

export type ApiRouteMatrixLeg = {
  origin_id: string;
  destination_id: string;
  mode: TransportMode;
  distance_meters: number;
  duration_minutes: number;
  provider?: "mock_map_provider" | "amap";
  polyline?: ApiGeoCoordinate[];
};

export type ApiMapPreview = {
  provider: "mock_map_provider" | "amap";
  preview_type: "mock_vector" | "mock_png" | "amap_static";
  fallback_used: boolean;
  coordinate_confidence?: "verified" | "mocked" | "missing";
  center?: ApiGeoCoordinate;
  points?: ApiMapPreviewPoint[];
  visual_points?: ApiMapPoint[];
  route_segments?: ApiRouteMatrixLeg[];
  total_distance_meters?: number;
  total_duration_minutes?: number;
  static_image_url?: string;
  note?: string;
};

export type ApiTransportOption = {
  mode: TransportMode;
  label: string;
  minutes: number;
  cost: string;
  detail: string;
};

export type ApiPoiAction = {
  id: string;
  label: string;
  kind: PoiAction["kind"];
  disabled?: boolean;
};

export type ApiRouteStop = {
  poi_id: string;
  poi_name: string;
  start_time: string;
  duration_minutes: number;
  reason: string;
  category?: PoiCategory;
  area?: string;
  rating?: number;
  avg_price?: number;
  queue_minutes?: number;
  tags?: string[];
  ugc_summary?: string;
  taste_summary?: string;
  env_summary?: string;
  images?: string[];
  head_pic?: string;
  distance_from_previous?: string;
  actions?: ApiPoiAction[];
  transport_options?: ApiTransportOption[];
  platform_badge?: string;
  platform_badges?: string[];
  taste_rating?: number;
  environment_rating?: number;
  service_rating?: number;
  recommended_dishes?: string[];
  review_count?: number;
  positive_rate?: string;
};

export type ApiTodoItem = {
  id: string;
  label: string;
  done?: boolean;
  stop_poi_id?: string;
  action_label?: string;
  action_kind?: TodoActionKind;
  action_references?: TodoActionReference[];
  constraints?: TodoConstraint[];
};

export type ApiRoutePlan = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  theme?: string;
  badge?: string;
  score: number;
  total_minutes: number;
  highlights?: string[];
  map_points?: ApiMapPoint[];
  map_preview?: ApiMapPreview;
  transport_summary?: string | Record<string, unknown>;
  transports?: ApiTransportOption[];
  stops?: ApiRouteStop[];
  todo_items?: ApiTodoItem[];
  rank_reason?: string;
  score_breakdown?: Record<string, unknown>;
};

export type RefinementChange = {
  type: "kept" | "replaced" | "reordered" | "updated_copy";
  stop_index?: number;
  before_poi_id?: string;
  after_poi_id?: string;
  reason: string;
};

export type RefinementDiff = {
  instruction: string;
  base_trace_id: string;
  base_route_id: string;
  strategy: "local_replace" | "local_reorder" | "full_rerun" | "copy_update";
  changes: RefinementChange[];
};

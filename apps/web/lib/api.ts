import type {
  ChatRequestPayload,
  ChatResponsePayload,
  DemoRoutePlan,
  GeneratedMockResponse,
  GenerateMockPoisRequest,
  GenerateMockUserRequest,
  InteractionRequestPayload,
  InteractionResponsePayload,
  MockPoi,
  MockUser,
  RoutePlan,
  RoutePlanRequestPayload,
  RoutePlanResponsePayload,
  RouteRefineRequestPayload,
  AgentTrace,
  PreferenceDetectionResponse,
  TraceSummary,
  TraceEvent,
  UserPreference,
  UserPreferenceProfile
} from "@/types/dzultra";

const API_BASE_URL = process.env.NEXT_PUBLIC_DZULTRA_API_BASE_URL ?? "http://localhost:8000";

export const mockUsers: MockUser[] = [
  {
    id: "user-date-001",
    name: "周六约会型用户",
    scenario: "下午想吃饭、看展、喝甜品，不想排队",
    preferences: ["低排队", "约会氛围", "可拍照", "步行友好"],
    avoidances: ["热门长队", "跨城移动", "噪声太大"]
  }
];

export const mockPois: MockPoi[] = [
  {
    id: "poi-001",
    name: "三里屯轻食 Bistro",
    category: "food",
    area: "三里屯",
    rating: 4.7,
    queueMinutes: 8,
    tags: ["约会", "低排队", "轻食"]
  },
  {
    id: "poi-002",
    name: "红砖当代艺术空间",
    category: "culture",
    area: "朝阳",
    rating: 4.8,
    queueMinutes: 5,
    tags: ["看展", "拍照", "安静"]
  },
  {
    id: "poi-003",
    name: "亮马河甜品露台",
    category: "dessert",
    area: "亮马桥",
    rating: 4.6,
    queueMinutes: 3,
    tags: ["甜品", "夜景", "松弛"]
  }
];

export const sampleRoute: RoutePlan = {
  id: "route-001",
  title: "低排队约会路线",
  score: 92,
  totalMinutes: 215,
  highlights: ["平均排队小于 10 分钟", "餐饮 + 文化 + 甜品", "移动距离短"],
  stops: [
    {
      poiId: "poi-001",
      poiName: "三里屯轻食 Bistro",
      startTime: "14:20",
      durationMinutes: 65,
      reason: "低排队且适合作为约会开场，口味风险较低。"
    },
    {
      poiId: "poi-002",
      poiName: "红砖当代艺术空间",
      startTime: "15:45",
      durationMinutes: 80,
      reason: "文化体验明确，UGC 中拍照与安静标签稳定。"
    },
    {
      poiId: "poi-003",
      poiName: "亮马河甜品露台",
      startTime: "17:35",
      durationMinutes: 55,
      reason: "收尾轻松，排队短，适合边休息边复盘路线。"
    }
  ]
};

export const presetPrompts = [
  "今天下午想在北京约会，不想排队，想吃饭加看展",
  "周末想找一条轻松拍照路线，最好少走路",
  "今晚临时约朋友吃饭，想顺路喝点甜的"
];

export const agentSteps = [
  { id: "router", agent: "InteractionRouterAgent", label: "判断任务类型", detail: "判断这是新规划、补全、微调、换方向还是普通问答。" },
  { id: "constraints", agent: "ConstraintDiscoveryAgent", label: "拆解目标和约束", detail: "把用户目标、硬约束、软约束和缺失信息写进约束账本。" },
  { id: "preference", agent: "UserPreferenceAgent", label: "读取长期偏好", detail: "读取历史收藏、评分、去过的店和 UGC 评价偏好。" },
  { id: "grounding", agent: "ContextGroundingAgent", label: "落地事实约束", detail: "调用 POI、UGC、地图、排队、天气和交通 mock provider。" },
  { id: "solver", agent: "PlanSolverAgent", label: "生成候选方案", detail: "用 slot 和路线规则生成多套可执行 plan。" },
  { id: "evaluator", agent: "PlanEvaluatorAgent", label: "校验并排序", detail: "检查硬约束、计算分数拆解，并选出 3 个方案。" },
  { id: "explanation", agent: "PlanExplanationAgent", label: "解释方案", detail: "把约束、风险和推荐理由整理成用户能懂的话。" }
];

type DemoTodoInput = Omit<DemoRoutePlan["todoItems"][number], "actionReferences" | "constraints"> & {
  reference: DemoRoutePlan["todoItems"][number]["actionReferences"][number];
  constraints?: DemoRoutePlan["todoItems"][number]["constraints"];
};

function createDemoTodoItem({ reference, constraints = [], ...todo }: DemoTodoInput): DemoRoutePlan["todoItems"][number] {
  return {
    ...todo,
    actionReferences: [reference],
    constraints
  };
}

export const demoRoutePlans: DemoRoutePlan[] = [
  {
    id: "route-date-low-queue",
    title: "低排队约会路线",
    subtitle: "吃饭 + 看展 + 甜品，节奏松弛",
    description: "综合考量大众点评榜单排名、用户评价口碑、餐厅环境特色及食材品质，为您精选了望京地区口碑最好的几家日料店，其中“酒鬼金横丁”和“鸟千禧”在口味和环境上均位居榜首。",
    theme: "约会低排队",
    badge: "可直接出发",
    score: 92,
    totalMinutes: 215,
    mapTone: "orange",
    mapPoints: [
      { x: 78, y: 142, label: "食" },
      { x: 190, y: 74, label: "展" },
      { x: 306, y: 156, label: "甜" }
    ],
    highlights: ["平均排队 5 分钟", "三段移动都在轻松范围", "约会氛围稳定"],
    transports: [
      { mode: "taxi", label: "打车", minutes: 26, cost: "¥38-52", detail: "推荐，少走路" },
      { mode: "drive", label: "驾车", minutes: 30, cost: "停车约 ¥20", detail: "停车稍紧张" },
      { mode: "transit", label: "公交", minutes: 48, cost: "¥5", detail: "换乘 1 次" }
    ],
    stops: [
      {
        poiId: "poi-001",
        poiName: "三里屯轻食 Bistro",
        category: "food",
        area: "三里屯",
        address: "太古里北区旁 · 近地铁 10 号线",
        rating: 4.7,
        avgPrice: 118,
        queueMinutes: 8,
        tags: ["约会", "低排队", "轻食"],
        startTime: "14:20",
        durationMinutes: 65,
        distanceFromPrevious: "起点附近",
        ugcSummary: "UGC 里常提到环境安静、上菜稳定，适合作为下午路线开场。",
        tasteSummary: "位居望京日式料理口味榜第1名，以食材新鲜、口味地道著称，深受食客好评。",
        envSummary: "位于望京小街下沉广场，日式居酒屋风格浓郁，包间私密性好，服务员还会主动提供清口糖果。",
        images: [
          "/mock-reference-assets/todo-reference-bistro-deal.png",
          "/mock-reference-assets/todo-reference-japanese-queue.png",
          "/mock-reference-assets/todo-reference-dessert-deal.png"
        ],
        reason: "低排队且适合作为约会开场，口味风险较低。",
        actions: [
          { id: "nav-001", label: "导航", kind: "navigate" },
          { id: "book-001", label: "预订", kind: "book" },
          { id: "deal-001", label: "双人套餐 ¥198", kind: "deal" }
        ],
        transportOptions: [
          { mode: "bike", label: "骑行", minutes: 15, cost: "", detail: "" },
          { mode: "metro", label: "地铁", minutes: 25, cost: "", detail: "" },
          { mode: "walk", label: "步行", minutes: 35, cost: "", detail: "" }
        ],
        platformBadge: "望京日式料理口味榜第1名",
        reviewCount: 2300,
        positiveRate: "近30天好评率99%"
      },
      {
        poiId: "poi-002",
        poiName: "红砖当代艺术空间",
        category: "culture",
        area: "朝阳",
        address: "崔各庄乡顺白路 · 展厅入口东侧",
        rating: 4.8,
        avgPrice: 68,
        queueMinutes: 5,
        tags: ["看展", "拍照", "安静"],
        startTime: "15:45",
        durationMinutes: 80,
        distanceFromPrevious: "打车约 18 分钟",
        ugcSummary: "近期评价集中在展陈清楚、空间好拍，下午人流比周末上午更平稳。",
        tasteSummary: "展陈设计清晰，空间光线柔和，拍照出片率高，是近期社交媒体上的热门打卡地。",
        envSummary: "展厅挑高开阔，动线设计合理，休息区配备充足，观展体验舒适不拥挤。",
        images: [
          "/mock-reference-assets/todo-reference-art-ticket.png",
          "/mock-reference-assets/todo-reference-lakeside-walk.png",
          "/mock-reference-assets/todo-reference-coffee-deal.png"
        ],
        reason: "文化体验明确，拍照和安静标签稳定。",
        actions: [
          { id: "nav-002", label: "导航", kind: "navigate" },
          { id: "ticket-002", label: "购票 ¥68", kind: "ticket" }
        ],
        transportOptions: [
          { mode: "taxi", label: "打车", minutes: 18, cost: "", detail: "" },
          { mode: "metro", label: "地铁", minutes: 32, cost: "", detail: "" },
          { mode: "walk", label: "步行", minutes: 45, cost: "", detail: "" }
        ],
        platformBadge: "朝阳区文化艺术空间热门榜第3名",
        reviewCount: 856,
        positiveRate: "近30天好评率96%"
      },
      {
        poiId: "poi-003",
        poiName: "亮马河甜品露台",
        category: "dessert",
        area: "亮马桥",
        address: "亮马河畔 · 二层露台区",
        rating: 4.6,
        avgPrice: 72,
        queueMinutes: 3,
        tags: ["甜品", "夜景", "松弛"],
        startTime: "17:35",
        durationMinutes: 55,
        distanceFromPrevious: "打车约 12 分钟",
        ugcSummary: "傍晚视野更好，甜品出品稳定，适合收尾聊天。",
        tasteSummary: "招牌提拉米苏和抹茶千层口碑最佳，甜度适中不腻，用料扎实。",
        envSummary: "二层露台直面亮马河，傍晚灯光柔和，微风拂面，是约会收尾的理想场所。",
        images: [
          "/mock-reference-assets/todo-reference-dessert-deal.png",
          "/mock-reference-assets/todo-reference-coffee-deal.png",
          "/mock-reference-assets/todo-reference-bistro-deal.png"
        ],
        reason: "收尾轻松，排队短，适合边休息边复盘路线。",
        actions: [
          { id: "nav-003", label: "导航", kind: "navigate" },
          { id: "queue-003", label: "在线排号", kind: "queue", disabled: true },
          { id: "deal-003", label: "甜品券 ¥39", kind: "deal" }
        ],
        transportOptions: [
          { mode: "taxi", label: "打车", minutes: 12, cost: "", detail: "" },
          { mode: "bike", label: "骑行", minutes: 20, cost: "", detail: "" },
          { mode: "walk", label: "步行", minutes: 38, cost: "", detail: "" }
        ],
        platformBadge: "亮马桥甜品环境榜第2名",
        reviewCount: 1543,
        positiveRate: "近30天好评率98%"
      }
    ],
    todoItems: [
      createDemoTodoItem({
        id: "todo-book-bistro",
        stopPoiId: "poi-001",
        label: "太古里北区轻食小馆 · 预约靠窗位并收藏团购",
        actionLabel: "预订",
        actionKind: "book",
        reference: {
          id: "ref-bistro-deal",
          type: "deal",
          title: "双人轻食套餐",
          subtitle: "主菜 + 沙拉 + 饮品，适合作为约会开场",
          imageUrl: "/mock-reference-assets/todo-reference-bistro-deal.png",
          price: "¥198",
          distance: "起点附近",
          badge: "团购",
          actionLabel: "买套餐",
          actionKind: "deal"
        },
        constraints: [
          { id: "bistro-booking", label: "预约提醒", detail: "靠窗位建议出发前 60 分钟备注，18:00 后排队上升。", severity: "warning", satisfied: true }
        ]
      }),
      createDemoTodoItem({
        id: "todo-ticket-art",
        stopPoiId: "poi-002",
        label: "红砖美术馆花园展 · 提前买票并确认闭馆时间",
        actionLabel: "购票",
        actionKind: "ticket",
        reference: {
          id: "ref-art-ticket",
          type: "ticket",
          title: "红砖美术馆花园展单人票",
          subtitle: "线上购票可核销，闭馆前一小时不建议加长停留",
          imageUrl: "/mock-reference-assets/todo-reference-art-ticket.png",
          price: "¥80",
          distance: "约 1.8km",
          badge: "景点",
          actionLabel: "买票",
          actionKind: "ticket"
        },
        constraints: [
          { id: "art-closing", label: "营业时间", detail: "计划 15:45 抵达，17:00 闭馆前可完成 65 分钟游览。", severity: "required", satisfied: true },
          { id: "art-ticket", label: "购票确认", detail: "无需提前 1 天预约；点仔仍需要在出发前提醒用户买票。", severity: "info", satisfied: true }
        ]
      }),
      createDemoTodoItem({
        id: "todo-deal-dessert",
        stopPoiId: "poi-003",
        label: "亮马河露台甜品 · 先看团购券，天气差切室内座",
        actionLabel: "查看团购",
        actionKind: "deal",
        reference: {
          id: "ref-dessert-deal",
          type: "deal",
          title: "双人甜品饮品券",
          subtitle: "日落后氛围更好，露台座不保证保留",
          imageUrl: "/mock-reference-assets/todo-reference-dessert-deal.png",
          price: "¥89",
          distance: "约 2.4km",
          badge: "团购",
          actionLabel: "领券",
          actionKind: "deal"
        },
        constraints: [
          { id: "dessert-weather", label: "天气兜底", detail: "露台受天气影响；下雨时切室内座，不影响最终 plan。", severity: "warning", satisfied: true }
        ]
      })
    ]
  },
  {
    id: "route-photo-gallery",
    title: "文艺出片路线",
    subtitle: "先展览后咖啡，照片和聊天都有",
    theme: "文艺打卡",
    badge: "出片率高",
    score: 88,
    totalMinutes: 235,
    mapTone: "blue",
    mapPoints: [
      { x: 86, y: 82, label: "展" },
      { x: 214, y: 126, label: "咖" },
      { x: 304, y: 74, label: "餐" }
    ],
    highlights: ["拍照点更集中", "咖啡馆可休息", "晚餐不赶时间"],
    transports: [
      { mode: "taxi", label: "打车", minutes: 32, cost: "¥45-60", detail: "推荐，动线顺" },
      { mode: "drive", label: "驾车", minutes: 35, cost: "停车约 ¥30", detail: "第二站停车方便" },
      { mode: "transit", label: "公交", minutes: 56, cost: "¥6", detail: "步行略多" }
    ],
    stops: [
      {
        poiId: "poi-101",
        poiName: "798 小幅影像展",
        category: "culture",
        area: "798",
        address: "酒仙桥路 4 号院 · E 区",
        rating: 4.7,
        avgPrice: 58,
        queueMinutes: 6,
        tags: ["小众展", "拍照", "室内"],
        startTime: "14:10",
        durationMinutes: 90,
        distanceFromPrevious: "起点打车约 15 分钟",
        ugcSummary: "展览体量不大但光线好，适合慢慢逛，不容易被人流打断。",
        reason: "比热门大展更安静，适合约会时边看边聊。",
        actions: [
          { id: "nav-101", label: "导航", kind: "navigate" },
          { id: "ticket-101", label: "购票 ¥58", kind: "ticket" }
        ]
      },
      {
        poiId: "poi-102",
        poiName: "灰盒子咖啡 Gallery",
        category: "dessert",
        area: "798",
        address: "七星东街 · 白色门头旁",
        rating: 4.5,
        avgPrice: 52,
        queueMinutes: 4,
        tags: ["咖啡", "安静", "可坐久"],
        startTime: "15:55",
        durationMinutes: 55,
        distanceFromPrevious: "步行约 7 分钟",
        ugcSummary: "座位周转较快，常被评价为适合展后休息。",
        reason: "和展览距离近，能把移动成本压到最低。",
        actions: [
          { id: "nav-102", label: "导航", kind: "navigate" },
          { id: "deal-102", label: "咖啡券 ¥29", kind: "deal" }
        ]
      },
      {
        poiId: "poi-103",
        poiName: "胡同里云南小馆",
        category: "food",
        area: "三元桥",
        address: "霄云路支巷 · 院内二层",
        rating: 4.6,
        avgPrice: 132,
        queueMinutes: 10,
        tags: ["云南菜", "氛围", "不重口"],
        startTime: "17:20",
        durationMinutes: 75,
        distanceFromPrevious: "打车约 16 分钟",
        ugcSummary: "招牌菜口味温和，环境不像网红店那么吵。",
        reason: "晚餐风险低，不辣也能吃得舒服。",
        actions: [
          { id: "nav-103", label: "导航", kind: "navigate" },
          { id: "book-103", label: "预订", kind: "book" }
        ]
      }
    ],
    todoItems: [
      createDemoTodoItem({
        id: "todo-ticket-photo",
        stopPoiId: "poi-101",
        label: "798 小幅影像展 · 展票需当天确认库存",
        actionLabel: "购票",
        actionKind: "ticket",
        reference: {
          id: "ref-photo-ticket",
          type: "ticket",
          title: "798 小幅影像展单人票",
          subtitle: "小众影像展，适合拍照和慢逛",
          imageUrl: "/mock-reference-assets/todo-reference-art-ticket.png",
          price: "¥58",
          distance: "约 2.1km",
          badge: "景点",
          actionLabel: "买票",
          actionKind: "ticket"
        },
        constraints: [
          { id: "photo-ticket-same-day", label: "约束通过", detail: "V2 Mock 已过滤需提前 1 天预约的大展，本方案只保留当天可购票展览。", severity: "required", satisfied: true }
        ]
      }),
      createDemoTodoItem({
        id: "todo-coffee-deal",
        stopPoiId: "poi-102",
        label: "灰盒子咖啡 Gallery · 展后休息可先看咖啡券",
        actionLabel: "查看团购",
        actionKind: "deal",
        reference: {
          id: "ref-coffee-deal",
          type: "deal",
          title: "双杯咖啡券",
          subtitle: "非高峰可用，适合展后休息",
          imageUrl: "/mock-reference-assets/todo-reference-coffee-deal.png",
          price: "¥56",
          distance: "步行 7 分钟",
          badge: "团购",
          actionLabel: "领券",
          actionKind: "deal"
        },
        constraints: [
          { id: "coffee-seat", label: "座位风险", detail: "不接受订座，热门展散场后可能短时满座。", severity: "warning", satisfied: true }
        ]
      }),
      createDemoTodoItem({
        id: "todo-book-yunnan",
        stopPoiId: "poi-103",
        label: "胡同里云南小馆 · 建议 17:00 前预订",
        actionLabel: "预订",
        actionKind: "book",
        reference: {
          id: "ref-yunnan-book",
          type: "booking",
          title: "晚餐订座",
          subtitle: "带上人数和到达时间，避免晚高峰等位",
          imageUrl: "/mock-reference-assets/todo-reference-bistro-deal.png",
          price: "人均 ¥132",
          distance: "约 2.8km",
          badge: "预约",
          actionLabel: "预订",
          actionKind: "book"
        },
        constraints: [
          { id: "yunnan-dinner", label: "营业时段", detail: "晚市 17:00 开始，计划 17:20 抵达，不撞午晚市休息。", severity: "required", satisfied: true }
        ]
      })
    ]
  },
  {
    id: "route-walk-light",
    title: "少走路舒适路线",
    subtitle: "把移动距离压低，保留吃饭和夜景",
    theme: "舒适省力",
    badge: "少走路",
    score: 86,
    totalMinutes: 205,
    mapTone: "green",
    mapPoints: [
      { x: 92, y: 154, label: "餐" },
      { x: 178, y: 116, label: "逛" },
      { x: 282, y: 126, label: "甜" }
    ],
    highlights: ["两段步行都小于 8 分钟", "适合临时出发", "雨天也能走"],
    transports: [
      { mode: "taxi", label: "打车", minutes: 18, cost: "¥28-40", detail: "推荐，最省力" },
      { mode: "drive", label: "驾车", minutes: 24, cost: "停车约 ¥18", detail: "商场停车稳" },
      { mode: "transit", label: "公交", minutes: 42, cost: "¥4", detail: "步行 1.1km" }
    ],
    stops: [
      {
        poiId: "poi-201",
        poiName: "蓝港日料小食堂",
        category: "food",
        area: "蓝色港湾",
        address: "蓝色港湾 B1 · 扶梯旁",
        rating: 4.5,
        avgPrice: 105,
        queueMinutes: 7,
        tags: ["日料", "不排队", "商场内"],
        startTime: "14:30",
        durationMinutes: 60,
        distanceFromPrevious: "起点打车约 10 分钟",
        ugcSummary: "翻台稳定，商场内动线清楚，天气不好也不影响。",
        reason: "低排队且室内动线友好，适合想省体力的安排。",
        actions: [
          { id: "nav-201", label: "导航", kind: "navigate" },
          { id: "queue-201", label: "在线排号", kind: "queue" }
        ]
      },
      {
        poiId: "poi-202",
        poiName: "蓝港湖边慢逛区",
        category: "shopping",
        area: "蓝色港湾",
        address: "湖畔步道 · 中庭连廊",
        rating: 4.4,
        queueMinutes: 0,
        tags: ["散步", "夜景", "少走路"],
        startTime: "15:45",
        durationMinutes: 65,
        distanceFromPrevious: "步行约 5 分钟",
        ugcSummary: "路线平坦，拍照点集中，适合不想频繁换地点。",
        reason: "不用跨区域移动，也能补足约会里的逛和拍照。",
        actions: [{ id: "nav-202", label: "导航", kind: "navigate" }]
      },
      {
        poiId: "poi-203",
        poiName: "湖边奶冻甜品铺",
        category: "dessert",
        area: "蓝色港湾",
        address: "湖边东侧 · 临水铺位",
        rating: 4.5,
        avgPrice: 48,
        queueMinutes: 5,
        tags: ["甜品", "临水", "轻松"],
        startTime: "17:05",
        durationMinutes: 50,
        distanceFromPrevious: "步行约 6 分钟",
        ugcSummary: "甜品不会太腻，傍晚灯光起来后体验更好。",
        reason: "作为收尾不用再打车，体力消耗最低。",
        actions: [
          { id: "nav-203", label: "导航", kind: "navigate" },
          { id: "deal-203", label: "甜品券 ¥26", kind: "deal" }
        ]
      }
    ],
    todoItems: [
      createDemoTodoItem({
        id: "todo-queue-japan",
        stopPoiId: "poi-201",
        label: "蓝港日料小食堂 · 到店前先看排队",
        actionLabel: "排号",
        actionKind: "queue",
        reference: {
          id: "ref-japanese-queue",
          type: "booking",
          title: "日料在线排号",
          subtitle: "商场内翻台稳定，雨天也不影响动线",
          imageUrl: "/mock-reference-assets/todo-reference-japanese-queue.png",
          price: "人均 ¥105",
          distance: "起点 10 分钟",
          badge: "排号",
          actionLabel: "排号",
          actionKind: "queue"
        },
        constraints: [
          { id: "japanese-queue", label: "排队阈值", detail: "Mock 排队 7 分钟，低于 10 分钟低排队阈值。", severity: "required", satisfied: true }
        ]
      }),
      createDemoTodoItem({
        id: "todo-share-walk",
        stopPoiId: "poi-202",
        label: "蓝港湖边慢逛区 · 分享路线给同行人确认集合点",
        actionLabel: "分享",
        actionKind: "share",
        reference: {
          id: "ref-lakeside-share",
          type: "share",
          title: "湖边慢逛集合点",
          subtitle: "开放街区无需预约，适合少走路路线",
          imageUrl: "/mock-reference-assets/todo-reference-lakeside-walk.png",
          price: "免费",
          distance: "步行 5 分钟",
          badge: "分享",
          actionLabel: "分享",
          actionKind: "share"
        },
        constraints: [
          { id: "walk-no-booking", label: "无需预约", detail: "开放式商业街区不需要提前预约，雨天可切室内连廊。", severity: "info", satisfied: true }
        ]
      }),
      createDemoTodoItem({
        id: "todo-deal-milk",
        stopPoiId: "poi-203",
        label: "湖边奶冻甜品铺 · 团购券可提前买",
        actionLabel: "查看团购",
        actionKind: "deal",
        reference: {
          id: "ref-milk-deal",
          type: "deal",
          title: "甜品双人券",
          subtitle: "临水座不保证，外带到湖边更稳",
          imageUrl: "/mock-reference-assets/todo-reference-dessert-deal.png",
          price: "¥52",
          distance: "步行 6 分钟",
          badge: "团购",
          actionLabel: "领券",
          actionKind: "deal"
        },
        constraints: [
          { id: "milk-seat", label: "座位提醒", detail: "傍晚临水位更紧张；排队长时可外带。", severity: "warning", satisfied: true }
        ]
      })
    ]
  }
];

export const traceEvents: TraceEvent[] = [
  {
    id: "trace-event-001",
    type: "run_started",
    label: "用户目标进入规划",
    durationMs: 42,
    summary: "收到用户目标：今天下午在北京约会，想吃饭加看展，不想排队。",
    input: {
      goal: "今天下午在北京约会，想吃饭加看展，不想排队。",
      city: "北京",
      constraints: ["低排队", "约会", "看展"]
    },
    metadata: mockTraceBilling("mock-orchestrator", 48, 20, 18)
  },
  {
    id: "trace-event-002",
    type: "agent_started",
    agent: "InteractionRouterAgent",
    label: "任务分流",
    durationMs: 618,
    summary: "结合 Plan 模式和页面状态，判断这是一条新的路线规划任务。",
    input: {
      goal: "今天下午在北京约会，想吃饭加看展，不想排队。",
      plan_mode: true,
      page: "start"
    },
    output: {
      intent_kind: "planning",
      interaction_type: "new_planning_task",
      time_window: "14:00-18:30",
      required_categories: ["food", "culture", "dessert"],
      missing_required_fields: []
    },
    metadata: mockTraceBilling("mock-reasoner-small", 456, 132, 383)
  },
  {
    id: "trace-event-003",
    type: "constraint_discovered",
    agent: "ConstraintDiscoveryAgent",
    label: "目标与约束发现",
    durationMs: 360,
    summary: "把用户目标、时间窗、人数、吃喝诉求和低排队要求写入约束账本。",
    output: {
      user_id: "user-date-001",
      city: "北京",
      constraint_ledger_version: "v3-constraint-ledger-001",
      constraints: ["时间窗", "人数", "吃饭加看展", "低排队"]
    },
    metadata: mockTraceBilling("mock-context-small", 180, 64, 190)
  },
  {
    id: "trace-event-004",
    type: "requirements_summarized",
    agent: "ConstraintDiscoveryAgent",
    label: "需求总结",
    durationMs: 430,
    summary: "阻塞字段已齐全，不需要再追问；非阻塞偏好写入默认假设。",
    output: {
      can_plan: true,
      collected: {
        area: "北京朝阳",
        people: 2,
        time_range: "14:00-18:30",
        food: "吃正餐 + 甜品"
      },
      assumptions: ["预算按人均 100-200 处理", "交通优先少折腾"]
    },
    metadata: mockTraceBilling("mock-reasoner-small", 240, 86, 260)
  },
  {
    id: "trace-event-005",
    type: "preference_detected",
    agent: "UserPreferenceAgent",
    label: "偏好识别",
    durationMs: 520,
    summary: "从本轮输入里识别低排队、约会氛围和看展偏好，作为排序权重。",
    output: {
      detected_preferences: ["低排队", "约会氛围", "看展", "可拍照"],
      updated_profile_fields: ["scenario", "avoidance"],
      confidence: 0.86
    },
    metadata: mockTraceBilling("mock-preference-small", 310, 96, 304)
  },
  {
    id: "trace-event-006",
    type: "tool_called",
    agent: "ContextGroundingAgent",
    label: "POI 检索",
    durationMs: 980,
    summary: "从 Mock POI 和 UGC 摘要中召回候选，并记录排除理由。",
    tool_name: "mock_poi_search",
    tool_input: {
      city: "北京",
      area_hint: "朝阳",
      categories: ["food", "culture", "dessert"],
      preference: "低排队"
    },
    tool_output: {
      candidate_count: 9,
      accepted_pois: [
        { id: "poi-001", name: "三里屯轻食 Bistro", reason: "排队短，适合作为约会开场。" },
        { id: "poi-002", name: "红砖当代艺术空间", reason: "看展和拍照标签稳定。" },
        { id: "poi-003", name: "亮马河甜品露台", reason: "收尾轻松，排队最短。" }
      ],
      rejected_pois: [
        { id: "poi-reject-001", name: "热门烤肉排队王", reason: "晚高峰排队 45 分钟，命中避雷点。" },
        { id: "poi-reject-002", name: "跨城湖景餐厅", reason: "跨区移动时间过长，不适合 4 小时窗口。" },
        { id: "poi-reject-003", name: "嘈杂 Livehouse", reason: "噪声风险高，不符合约会聊天场景。" }
      ],
      ugc_hits: ["环境安静", "下午人流平稳", "甜品出品稳定"]
    },
    metadata: { ...mockTraceBilling("mock-retrieval-ranker", 512, 168, 726), tool_duration_ms: 980 }
  },
  {
    id: "trace-event-007",
    type: "context_grounded",
    agent: "ContextGroundingAgent",
    label: "POI 与 UGC 已落地",
    durationMs: 84,
    summary: "候选池、排除理由和 UGC 风险已经落到结构化事实，继续在同一 Agent 内计算地图距离。",
    output: {
      grounded_sections: ["poi", "ugc", "queue"]
    },
    metadata: mockTraceBilling("mock-orchestrator", 92, 32, 24)
  },
  {
    id: "trace-event-008",
    type: "map_context_resolved",
    agent: "ContextGroundingAgent",
    label: "地图距离计算",
    durationMs: 760,
    summary: "通过 mock_map_provider 生成坐标、距离矩阵、通勤时间和地图预览。",
    tool_name: "mock_route_matrix",
    tool_input: {
      provider: "mock_map_provider",
      mode: "taxi",
      poi_ids: ["poi-001", "poi-002", "poi-003"]
    },
    tool_output: {
      provider: "mock_map_provider",
      fallback_used: false,
      preview_type: "mock_vector",
      coordinate_confidence: "mocked",
      total_distance_meters: 9200,
      total_duration_minutes: 30,
      legs: [
        { origin_id: "poi-001", destination_id: "poi-002", duration_minutes: 18, distance_meters: 5600 },
        { origin_id: "poi-002", destination_id: "poi-003", duration_minutes: 12, distance_meters: 3600 }
      ]
    },
    metadata: { ...mockTraceBilling("mock-map-provider", 220, 70, 360), tool_duration_ms: 760 }
  },
  {
    id: "trace-event-009",
    type: "route_candidate_generated",
    agent: "PlanSolverAgent",
    label: "路线编排",
    durationMs: 1040,
    summary: "把候选 POI 编排成 3 套可执行路线，保留不同体验侧重点。",
    output: {
      plan_ids: ["route-date-low-queue", "route-photo-gallery", "route-walk-light"],
      fixed_plan_count: 3,
      schedule: ["14:20 餐饮", "15:45 看展", "17:35 甜品"]
    },
    metadata: mockTraceBilling("mock-planner-small", 420, 156, 620)
  },
  {
    id: "trace-event-010",
    type: "constraint_checked",
    agent: "PlanEvaluatorAgent",
    label: "约束校验",
    durationMs: 520,
    summary: "检查营业、排队、预算、距离和体验完整度，给每套方案生成约束摘要。",
    output: {
      constraints: [
        { name: "营业时间", status: "pass", detail: "三站到达时段均营业。" },
        { name: "排队风险", status: "pass", detail: "推荐方案平均排队 5 分钟。" },
        { name: "预算", status: "pass", detail: "按人均 100-200 可控。" },
        { name: "移动距离", status: "warning", detail: "文艺出片路线打车时间略长。" }
      ],
      rejected_route_reasons: ["跨区移动超出时间窗", "热门餐厅排队不可控"]
    },
    metadata: mockTraceBilling("mock-reasoner-small", 290, 88, 322)
  },
  {
    id: "trace-event-011",
    type: "route_scored",
    agent: "PlanEvaluatorAgent",
    label: "方案评分",
    durationMs: 620,
    summary: "综合排队、移动距离、偏好匹配和体验完整度，对 3 套方案排序。",
    output: {
      selected_plan_id: "route-date-low-queue",
      route_score: 92,
      plan_count: 3,
      plan_scores: [
        {
          plan_id: "route-date-low-queue",
          score: 92,
          rank_reason: "排队最低，吃饭、看展、甜品都在时间窗内，移动距离可控。",
          score_breakdown: { preference: 24, queue: 22, distance: 18, budget: 14, ugc: 14 }
        },
        {
          plan_id: "route-photo-gallery",
          score: 88,
          rank_reason: "拍照体验更强，但晚餐跨区移动略多。",
          score_breakdown: { preference: 22, queue: 19, distance: 15, budget: 14, ugc: 18 }
        },
        {
          plan_id: "route-walk-light",
          score: 86,
          rank_reason: "最省体力，体验丰富度略低于前两套。",
          score_breakdown: { preference: 19, queue: 20, distance: 22, budget: 13, ugc: 12 }
        }
      ]
    },
    metadata: mockTraceBilling("mock-judge-small", 376, 96, 212)
  },
  {
    id: "trace-event-012",
    type: "run_completed",
    agent: "PlanExplanationAgent",
    label: "输出可解释方案",
    durationMs: 420,
    summary: "返回固定 3 套路线方案、用户端解释文案和完整 Debug Trace JSON。",
    output: {
      plan_count: 3,
      selected_plan_id: "route-date-low-queue",
      response_shape: ["plan", "plans", "trace", "generation_metadata"],
      map_provider: "mock_map_provider"
    },
    metadata: mockTraceBilling("mock-copywriter-small", 280, 132, 310)
  }
];

function mockTraceBilling(modelName: string, inputTokens: number, outputTokens: number, modelDurationMs: number): TraceEvent["metadata"] {
  return {
    billing_mode: "mock_estimate",
    model_name: modelName,
    model_duration_ms: modelDurationMs,
    token_usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens
    },
    estimated_cost_cny: Number(((inputTokens * 0.002 + outputTokens * 0.006) / 1000).toFixed(6))
  };
}

export function createLocalFallbackTrace(userGoal: string, selectedPlanId = demoRoutePlans[0].id): AgentTrace {
  return {
    id: `trace-local-fallback-${selectedPlanId}`,
    user_goal: userGoal,
    status: "completed",
    total_duration_ms: traceEvents.reduce((sum, event) => sum + (event.durationMs ?? event.duration_ms ?? 0), 0),
    route_score: demoRoutePlans.find((plan) => plan.id === selectedPlanId)?.score ?? demoRoutePlans[0].score,
    runner_mode: "deterministic_mock",
    events: traceEvents,
    metadata: {
      fallback_reason: "api_unavailable",
      selected_plan_id: selectedPlanId,
      plan_count: demoRoutePlans.length,
      map_provider: "mock_map_provider",
      response_shape: ["plan", "plans", "trace", "generation_metadata"]
    }
  };
}

export function createLocalChatTrace(question: string): AgentTrace {
  const events: TraceEvent[] = [
    {
      id: "chat-trace-event-001",
      type: "run_started",
      label: "用户问题进入问答",
      durationMs: 36,
      summary: `收到普通 POI 问答：${question}`,
      input: { question, plan_mode: false, page: "searching" },
      metadata: mockTraceBilling("mock-orchestrator", 36, 12, 14)
    },
    {
      id: "chat-trace-event-002",
      type: "context_collected",
      agent: "ContextGroundingAgent",
      label: "附近上下文",
      durationMs: 260,
      summary: "读取当前位置、Mock 用户偏好和附近 POI 摘要，不进入完整路线排程。",
      output: {
        city: "北京",
        user_id: "user-date-001",
        preferences: mockUsers[0]?.preferences ?? []
      },
      metadata: mockTraceBilling("mock-context-small", 120, 48, 144)
    },
    {
      id: "chat-trace-event-003",
      type: "tool_called",
      agent: "ContextGroundingAgent",
      label: "相关 POI 检索",
      durationMs: 540,
      summary: "只召回相关 POI，不生成 3 套路线。",
      tool_name: "mock_nearby_poi_search",
      tool_input: { question, max_results: 3 },
      tool_output: {
        related_pois: mockPois.map((poi) => ({
          id: poi.id,
          name: poi.name,
          reason: `${poi.area} · ${poi.tags.slice(0, 2).join("、")}`
        }))
      },
      metadata: { ...mockTraceBilling("mock-retrieval-ranker", 220, 88, 260), tool_duration_ms: 540 }
    },
    {
      id: "chat-trace-event-004",
      type: "chat_answered",
      agent: "ChatAnswerAgent",
      label: "普通问答回答",
      durationMs: 680,
      summary: "生成 answer + related_pois + trace，不进入路线方案页。",
      output: {
        answer: "根据附近 Mock POI，优先推荐排队短、适合聊天或轻松停留的地点。",
        related_poi_ids: mockPois.map((poi) => poi.id),
        response_shape: ["answer", "related_pois", "trace"]
      },
      metadata: mockTraceBilling("mock-chat-small", 360, 148, 420)
    },
    {
      id: "chat-trace-event-005",
      type: "run_completed",
      agent: "ChatAnswerAgent",
      label: "问答链路完成",
      durationMs: 80,
      summary: "普通 POI 问答完成，Debug 面板保留候选和回答 trace。",
      output: { plan_count: 0, interaction_type: "chat_answer" },
      metadata: mockTraceBilling("mock-orchestrator", 60, 24, 30)
    }
  ];

  return {
    id: `trace-local-chat-${slugForTraceId(question)}`,
    user_goal: question,
    status: "completed",
    total_duration_ms: events.reduce((sum, event) => sum + (event.durationMs ?? event.duration_ms ?? 0), 0),
    runner_mode: "deterministic_mock",
    events,
    metadata: {
      interaction_type: "chat_answer",
      fallback_reason: "api_unavailable",
      fallback_provider: "local_chat_mock",
      response_shape: ["answer", "related_pois", "trace"]
    }
  };
}

export function createLocalRefinementTrace(
  baseTrace: AgentTrace | undefined,
  instruction: string,
  routeId: string,
  changedStopId?: string
): AgentTrace {
  const baseEvents = baseTrace?.events.length ? baseTrace.events : traceEvents;
  const refinementEvents: TraceEvent[] = [
    {
      id: `refine-trace-event-${routeId}-001`,
      type: "user_refinement_received",
      agent: "InteractionRouterAgent",
      label: "收到微调指令",
      durationMs: 140,
      summary: `用户要求：${instruction}`,
      input: { instruction, route_id: routeId, changed_stop_id: changedStopId },
      output: {
        interaction_type: "refine_current_plan",
        strategy: "local_replace",
        affected_stop_id: changedStopId
      },
      metadata: mockTraceBilling("mock-orchestrator", 96, 38, 44)
    },
    {
      id: `refine-trace-event-${routeId}-002`,
      type: "route_scored",
      agent: "PlanEvaluatorAgent",
      label: "微调后重排",
      durationMs: 360,
      summary: "保留当前路线结构，对受影响站点做局部替换并重新计算方案解释。",
      output: {
        selected_plan_id: routeId,
        changed_stop_id: changedStopId,
        rerank_reason: "局部替换后仍满足低排队和少走路约束。"
      },
      metadata: mockTraceBilling("mock-judge-small", 180, 72, 160)
    }
  ];

  return {
    id: `trace-local-refine-${routeId}`,
    user_goal: baseTrace?.user_goal ?? "本地微调路线",
    status: "completed",
    total_duration_ms:
      (baseTrace?.total_duration_ms ?? traceEvents.reduce((sum, event) => sum + (event.durationMs ?? event.duration_ms ?? 0), 0)) +
      refinementEvents.reduce((sum, event) => sum + (event.durationMs ?? event.duration_ms ?? 0), 0),
    route_score: baseTrace?.route_score,
    runner_mode: baseTrace?.runner_mode ?? "deterministic_mock",
    agent_strategy: baseTrace?.agent_strategy,
    events: [...baseEvents, ...refinementEvents],
    metadata: {
      ...baseTrace?.metadata,
      interaction_type: "refine_current_plan",
      selected_plan_id: routeId,
      changed_stop_id: changedStopId
    }
  };
}

function slugForTraceId(value: string) {
  const encoded = encodeURIComponent(value.trim().slice(0, 24));
  return encoded.replace(/%/g, "").replace(/[^a-zA-Z0-9_-]/g, "-") || "question";
}

export async function planRoute(payload: RoutePlanRequestPayload): Promise<RoutePlanResponsePayload> {
  const response = await fetch(`${API_BASE_URL}/routes/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: payload.user_id,
      goal: payload.goal,
      city: payload.city ?? "北京",
      constraints: payload.constraints ?? [],
      plan_mode: payload.plan_mode ?? true,
      interaction_context: payload.interaction_context,
      clarification_answers: payload.clarification_answers,
      skip_clarification: payload.skip_clarification,
      require_confirmation: payload.require_confirmation,
      confirmed_requirements: payload.confirmed_requirements,
      previous_trace_id: payload.previous_trace_id,
      preference_detection_enabled: payload.preference_detection_enabled
    })
  });

  if (!response.ok) {
    throw new Error("路线规划接口暂时不可用");
  }

  return response.json();
}

export async function refineRoute(payload: RouteRefineRequestPayload): Promise<RoutePlanResponsePayload> {
  const response = await fetch(`${API_BASE_URL}/routes/refine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      trace_id: payload.trace_id,
      route_id: payload.route_id,
      instruction: payload.instruction
    })
  });

  if (!response.ok) {
    throw new Error("路线微调接口暂时不可用");
  }

  return response.json();
}

export async function chatRespond(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
  const response = await fetch(`${API_BASE_URL}/chat/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: payload.user_id ?? "anonymous",
      message: payload.message,
      city: payload.city ?? "北京",
      plan_mode: payload.plan_mode ?? false,
      interaction_context: payload.interaction_context,
      constraints: payload.constraints ?? [],
      related_poi_limit: payload.related_poi_limit ?? 3
    })
  });

  if (!response.ok) {
    throw new Error("普通问答接口暂时不可用");
  }

  return response.json();
}

export async function interactRespond(payload: InteractionRequestPayload): Promise<InteractionResponsePayload> {
  const response = await fetch(`${API_BASE_URL}/interactions/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: payload.user_id ?? "anonymous",
      message: payload.message,
      city: payload.city ?? "北京",
      plan_mode: payload.plan_mode ?? true,
      interaction_context: payload.interaction_context,
      constraints: payload.constraints ?? [],
      clarification_answers: payload.clarification_answers ?? {},
      preference_detection_enabled: payload.preference_detection_enabled ?? true
    })
  });

  if (!response.ok) {
    throw new Error("统一交互接口暂时不可用");
  }

  return response.json();
}

export async function listTraces(): Promise<TraceSummary[]> {
  const response = await fetch(`${API_BASE_URL}/traces`);

  if (!response.ok) {
    throw new Error("Trace 列表接口暂时不可用");
  }

  return response.json();
}

export async function getTrace(traceId: string): Promise<AgentTrace> {
  const response = await fetch(`${API_BASE_URL}/traces/${traceId}`);

  if (!response.ok) {
    throw new Error("Trace 详情接口暂时不可用");
  }

  return response.json();
}

export async function listUserPreferences(userId: string): Promise<UserPreferenceProfile> {
  const response = await fetch(`${API_BASE_URL}/profiles/${userId}/preferences`);

  if (!response.ok) {
    throw new Error("用户偏好接口暂时不可用");
  }

  return response.json();
}

export async function detectUserPreferences(payload: {
  user_id: string;
  utterance: string;
  source_trace_id?: string;
}): Promise<PreferenceDetectionResponse> {
  const response = await fetch(`${API_BASE_URL}/profiles/preferences/detect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("偏好检测接口暂时不可用");
  }

  return response.json();
}

export async function updateUserPreferenceOnApi(
  userId: string,
  preferenceId: string,
  label: string
): Promise<UserPreference> {
  const response = await fetch(`${API_BASE_URL}/profiles/${userId}/preferences/${preferenceId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ label })
  });

  if (!response.ok) {
    throw new Error("偏好修正接口暂时不可用");
  }

  return response.json();
}

export async function deleteUserPreferenceOnApi(userId: string, preferenceId: string): Promise<UserPreferenceProfile> {
  const response = await fetch(`${API_BASE_URL}/profiles/${userId}/preferences/${preferenceId}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("偏好删除接口暂时不可用");
  }

  return response.json();
}

// ===== AI Mock 生成器：演示者/评审通过 MockDataAgent 生成 Mock User / POI =====

export async function listMockUsers(): Promise<MockUser[]> {
  const response = await fetch(`${API_BASE_URL}/mock/users`);
  if (!response.ok) {
    throw new Error("Mock 用户列表接口暂时不可用");
  }
  return response.json();
}

export async function listMockPois(): Promise<MockPoi[]> {
  const response = await fetch(`${API_BASE_URL}/mock/pois`);
  if (!response.ok) {
    throw new Error("Mock POI 列表接口暂时不可用");
  }
  return response.json();
}

export async function generateMockUser(payload: GenerateMockUserRequest): Promise<GeneratedMockResponse> {
  const response = await fetch(`${API_BASE_URL}/mock/generate-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_type: payload.user_type ?? "regular",
      city: payload.city ?? "北京",
      scenario: payload.scenario ?? "周六下午本地约会路线"
    })
  });

  if (!response.ok) {
    throw new Error("Mock 用户生成接口暂时不可用");
  }

  return normalizeGeneratedMockResponse(await response.json());
}

export async function generateMockPois(payload: GenerateMockPoisRequest): Promise<GeneratedMockResponse> {
  const response = await fetch(`${API_BASE_URL}/mock/generate-pois`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      city: payload.city ?? "北京",
      area: payload.area ?? "三里屯",
      theme: payload.theme ?? "低排队约会路线",
      count: payload.count ?? 6
    })
  });

  if (!response.ok) {
    throw new Error("Mock POI 生成接口暂时不可用");
  }

  return normalizeGeneratedMockResponse(await response.json());
}

function normalizeGeneratedMockResponse(response: GeneratedMockResponse): GeneratedMockResponse {
  return {
    ...response,
    users: (response.users ?? []).map((user) => ({
      ...user,
      user_type: user.user_type ?? "regular",
      priority_weights: user.priority_weights ?? {},
      explain_focus: user.explain_focus ?? [],
      preferences: user.preferences ?? [],
      avoidances: user.avoidances ?? []
    })),
    pois: (response.pois ?? []).map((poi) => normalizeMockPoi(poi))
  };
}

function normalizeMockPoi(poi: MockPoi & Record<string, unknown>): MockPoi {
  return {
    ...poi,
    queueMinutes: numberValue(poi.queueMinutes ?? poi.queue_minutes) ?? 0,
    reviewCount: numberValue(poi.reviewCount ?? poi.review_count),
    avgPrice: numberValue(poi.avgPrice ?? poi.avg_price),
    openHours: stringValue(poi.openHours ?? poi.open_hours),
    businessStatus: stringValue(poi.businessStatus ?? poi.business_status),
    visitDurationMinutes: numberValue(poi.visitDurationMinutes ?? poi.visit_duration_minutes),
    ugcSummary: stringValue(poi.ugcSummary ?? poi.ugc_summary),
    platformBadges: arrayValue<string>(poi.platformBadges ?? poi.platform_badges),
    serviceOptions: arrayValue<string>(poi.serviceOptions ?? poi.service_options),
    riskNotes: arrayValue<string>(poi.riskNotes ?? poi.risk_notes),
    tags: arrayValue<string>(poi.tags),
  };
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function arrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// ===== SSE 流式交互接口 =====

export type StreamCallbacks = {
  /** 收到 trace 元信息（events 为空，status 为 running） */
  onTraceMeta?: (trace: AgentTrace) => void;
  /** 收到单个 trace event */
  onTraceEvent?: (event: TraceEvent, accumulatedEvents: TraceEvent[]) => void;
  /** 收到完整 response（包含最终 trace、plans 等） */
  onResponseComplete?: (response: InteractionResponsePayload) => void;
  /** SSE 连接错误 */
  onError?: (error: Error) => void;
};

/**
 * 流式调用 /interactions/respond/stream，通过 SSE 逐步接收 trace events。
 * 返回一个 abort 函数，调用可中断 SSE 连接。
 */
export function interactRespondStream(
  payload: InteractionRequestPayload,
  callbacks: StreamCallbacks
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/interactions/respond/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          user_id: payload.user_id ?? "anonymous",
          message: payload.message,
          city: payload.city ?? "北京",
          plan_mode: payload.plan_mode ?? true,
          interaction_context: payload.interaction_context,
          constraints: payload.constraints ?? [],
          clarification_answers: payload.clarification_answers ?? {},
          preference_detection_enabled: payload.preference_detection_enabled ?? true
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`流式交互接口返回 ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法获取 SSE 流");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedEvents: TraceEvent[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 消息：以 \n\n 分隔
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? ""; // 最后一个可能不完整，保留

        for (const message of messages) {
          if (!message.trim()) continue;

          let eventType = "";
          let data = "";

          for (const line of message.split("\n")) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              data = line.slice(6);
            }
          }

          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            if (eventType === "trace_meta") {
              accumulatedEvents = [];
              callbacks.onTraceMeta?.(parsed as AgentTrace);
            } else if (eventType === "trace_event") {
              accumulatedEvents = [...accumulatedEvents, parsed as TraceEvent];
              callbacks.onTraceEvent?.(parsed as TraceEvent, accumulatedEvents);
            } else if (eventType === "response_complete") {
              callbacks.onResponseComplete?.(parsed as InteractionResponsePayload);
            }
          } catch {
            // 忽略解析失败的 SSE 消息
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        callbacks.onError?.(error);
      }
    }
  })();

  return () => controller.abort();
}

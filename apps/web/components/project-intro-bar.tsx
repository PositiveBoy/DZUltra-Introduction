"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDown, ChevronUp, ArrowLeft, X, Mail, Users, Trophy, Sparkles,
  Link2, Bot, Clock, CloudRain, Lightbulb, Eye, Layers, LayoutGrid,
  MessageSquareText, Database, UserCircle, ShieldCheck, Route, GitGraph
} from "lucide-react";
import { useDemoStore } from "@/stores/use-demo-store";
import Image from "next/image";

const authors = ["周鸿铭", "王涵琪"];
const eventLine = "美团 2026 AI Hackthon 大赛 赛题5「现在就出发：AI本地路线智能规划」";

// ========== 卡片数据 ==========
const cards = [
  {
    id: "constraint",
    eyebrow: "架构创新",
    title: "约束账本",
    desc: "你的每一个需求都会被认真对待。从发现、落地、校验到解释，全程透明可追溯。",
    tag: "透明可信",
    detail: {
      why: "传统推荐系统像是一个黑盒，用户不知道为什么会收到这些推荐，也不知道自己的哪些需求被忽略了。",
      how: "我们为每一条用户意图建立'约束账本'——从发现、落地、校验到解释，全程记录。就像一本清晰的旅行手账，每一页都写得明明白白。",
      what: "推荐理由不再模糊。你可以清楚地看到：为什么选这家餐厅、为什么跳过那个景点、每个决定背后的逻辑是什么。",
    },
  },
  {
    id: "agent",
    eyebrow: "系统架构",
    title: "七维协作",
    desc: "七个专业 Agent 各司其职，理解、规划、调度一气呵成。",
    tag: "高效精准",
    detail: {
      why: "单一模型很难同时做好理解、规划、检索、校验等所有事情。就像一个人不可能同时是导游、司机、气象员和美食评论家。",
      how: "七个 Agent 组成专业团队：意图理解、上下文补全、候选检索、约束检查、路线编排、解释生成、偏好学习。每个 Agent 只做自己最擅长的事。",
      what: "主链路仅需 2-3 次 LLM 调用，其余由确定性工具完成。更快、更稳、更可解释。",
    },
  },
  {
    id: "queue",
    eyebrow: "数据智能",
    title: "时间先知",
    desc: "提前预知每个目的地的等待时间，让约会从不被排队打扰。",
    tag: "从容出行",
    detail: {
      why: "最破坏心情的，不是路程远，而是到了才发现要排两小时队。",
      how: "结合实时排队数据与到达时间预测，在规划阶段就预判每个目的地的等待情况。如果某处太拥挤，系统会温柔地建议更好的时间点或替代选择。",
      what: "你的行程像被一位细心的管家提前打理好。到达时，刚好有位子；离开时，刚好避开高峰。",
    },
  },
  {
    id: "weather",
    eyebrow: "环境感知",
    title: "因天制宜",
    desc: "雨天自动推荐室内路线，晴天拥抱户外风光。",
    tag: "贴心应变",
    detail: {
      why: "天气变了，计划没变，这是多少出行遗憾的源头。",
      how: "实时感知降水概率、温度、交通状况。雨天优先室内路线，晴天推荐户外漫步。地铁、驾车、骑行、步行四种方式实时对比，给出最适合当下的建议。",
      what: "无论晴雨，你的路线总是恰到好处。不用看天发愁，因为系统已经帮你想好了。",
    },
  },
  {
    id: "preference",
    eyebrow: "个性化",
    title: "愈用愈懂",
    desc: "每一次选择都在加深理解。你的偏好会被温柔记忆。",
    tag: "持续进化",
    detail: {
      why: "每次都要重新说明'我不吃辣'、'我喜欢安静的地方'，这种重复让人疲惫。",
      how: "从你的一次次输入、选择和微调中学习。喜欢川菜？偏好安静？厌倦排队？系统会记住，并在下次推荐时默默考虑。",
      what: "用久了，你会发现推荐越来越对味。不是巧合，是系统在用心了解你。",
    },
  },
  {
    id: "explain",
    eyebrow: "透明度",
    title: "明明白白",
    desc: "每个决定都有清晰理由，拒绝一切黑盒操作。",
    tag: "可解释",
    detail: {
      why: "AI 推荐的信任危机，往往来自'它为什么这么推荐？'这个无法回答的问题。",
      how: "每个推荐决策都附带完整的解释链路：为什么选 A 不选 B、哪些约束被满足、哪些被权衡、评分如何拆解。右侧 Debug Trace 面板可以回放整个思考过程。",
      what: "你不需要相信一个黑盒。你可以看懂每一个决定，因为一切都摊开在阳光下。",
    },
  },
];

// ========== SVG 几何动画 ==========
function ConstraintVisual({ isActive }: { isActive: boolean }) {
  return (
    <svg viewBox="0 0 200 60" className="w-full h-full">
      <defs>
        <linearGradient id="chainGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffd84d" />
          <stop offset="50%" stopColor="#FF662B" />
          <stop offset="100%" stopColor="#ffd84d" />
        </linearGradient>
      </defs>
      <path
        d="M 20 30 Q 55 12, 90 30 T 180 30"
        fill="none"
        stroke="url(#chainGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="8 5"
        style={{ animation: isActive ? "dz-dash-flow 2s linear infinite" : "none" }}
      />
      {[
        { x: 20, y: 30 },
        { x: 55, y: 18 },
        { x: 125, y: 18 },
        { x: 180, y: 30 },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="6" fill="#fff5eb" stroke="#FF662B" strokeWidth="1" />
          <circle
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="#FF662B"
            style={{ animation: isActive ? `dz-dot-pulse 2s ease-in-out ${i * 0.3}s infinite` : "none" }}
          />
        </g>
      ))}
    </svg>
  );
}

function AgentVisual({ isActive }: { isActive: boolean }) {
  const center = { x: 100, y: 30 };
  const nodes = [
    { x: 100, y: 6 },
    { x: 58, y: 18 },
    { x: 142, y: 18 },
    { x: 68, y: 44 },
    { x: 132, y: 44 },
    { x: 100, y: 52 },
  ];
  return (
    <svg viewBox="0 0 200 60" className="w-full h-full">
      {nodes.map((n, i) => (
        <line key={i} x1={center.x} y1={center.y} x2={n.x} y2={n.y} stroke="#ece7dc" strokeWidth="1" />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="5" fill="#fff5eb" />
          <circle
            cx={n.x}
            cy={n.y}
            r="2"
            fill="#FF662B"
            style={{ animation: isActive ? `dz-dot-pulse 2s ease-in-out ${i * 0.25}s infinite` : "none" }}
          />
        </g>
      ))}
      <circle cx={center.x} cy={center.y} r="8" fill="#FF662B" opacity="0.1" />
      <circle cx={center.x} cy={center.y} r="4" fill="#FF662B" />
    </svg>
  );
}

function QueueVisual({ isActive }: { isActive: boolean }) {
  return (
    <svg viewBox="0 0 200 60" className="w-full h-full">
      <defs>
        <radialGradient id="queueGrad" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#FF662B" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#FF662B" stopOpacity="0" />
        </radialGradient>
      </defs>
      <line x1="20" y1="48" x2="180" y2="48" stroke="#ece7dc" strokeWidth="1.5" strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={40 + i * 45} cy="48" r="2.5" fill={i === 2 ? "#FF662B" : "#ece7dc"} />
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx="100"
          cy="22"
          r={10 + i * 10}
          fill="none"
          stroke="#FF662B"
          strokeWidth="1"
          opacity="0.2"
          style={{
            animation: isActive ? `dz-pulse-ring 2.5s ease-out ${i * 0.6}s infinite` : "none",
            transformOrigin: "100px 22px",
          }}
        />
      ))}
      <circle cx="100" cy="22" r="8" fill="url(#queueGrad)" />
      <circle cx="100" cy="22" r="5" fill="#FF662B" />
    </svg>
  );
}

function WeatherVisual({ isActive }: { isActive: boolean }) {
  return (
    <svg viewBox="0 0 200 60" className="w-full h-full">
      <path
        d="M 20 42 Q 60 14, 90 28 T 160 12"
        fill="none"
        stroke="#ece7dc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="5 4"
      />
      <path
        d="M 20 42 Q 60 14, 90 28 T 160 12"
        fill="none"
        stroke="#FF662B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="5 4"
        style={{ animation: isActive ? "dz-dash-flow 2s linear infinite" : "none" }}
      />
      <circle cx="20" cy="42" r="4" fill="#FF662B" />
      <circle cx="160" cy="12" r="4" fill="#ffd84d" />
      <g style={{ animation: isActive ? "dz-float 3s ease-in-out infinite" : "none" }}>
        <ellipse cx="135" cy="36" rx="14" ry="8" fill="#e8f4fd" />
        <ellipse cx="145" cy="30" rx="10" ry="7" fill="#e8f4fd" />
        {[129, 137, 145].map((x, i) => (
          <line
            key={i}
            x1={x}
            y1="40"
            x2={x - 1}
            y2="48"
            stroke="#56A4F0"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.5"
            style={{ animation: isActive ? `dz-dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite` : "none" }}
          />
        ))}
      </g>
    </svg>
  );
}

function PreferenceVisual({ isActive }: { isActive: boolean }) {
  const steps = [
    { x: 30, y: 50, h: 10 },
    { x: 62, y: 44, h: 16 },
    { x: 94, y: 36, h: 24 },
    { x: 126, y: 24, h: 36 },
  ];
  return (
    <svg viewBox="0 0 200 60" className="w-full h-full">
      <line x1="16" y1="54" x2="184" y2="54" stroke="#ece7dc" strokeWidth="1.5" />
      {steps.map((s, i) => (
        <g key={i}>
          <rect
            x={s.x - 10}
            y={s.y - s.h}
            width="20"
            height={s.h}
            rx="3"
            fill={i === 3 ? "#FF662B" : "#fff5eb"}
            opacity={i === 3 ? 0.9 : 0.7}
            style={{ animation: isActive ? `dz-float 3s ease-in-out ${i * 0.2}s infinite` : "none" }}
          />
        </g>
      ))}
      <path
        d="M 34 42 Q 100 10, 166 18"
        fill="none"
        stroke="#FF662B"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="4 3"
        style={{ animation: isActive ? "dz-dash-flow 3s linear infinite" : "none" }}
      />
      <polygon points="162,16 168,18 165,24" fill="#FF662B" />
    </svg>
  );
}

function ExplainVisual({ isActive }: { isActive: boolean }) {
  const points = [
    { x: 100, y: 8 },
    { x: 152, y: 24 },
    { x: 136, y: 52 },
    { x: 64, y: 52 },
    { x: 48, y: 24 },
  ];
  const data = [0.92, 0.78, 0.88, 0.72, 0.96];
  const dataPoints = points.map((p, i) => ({
    x: 100 + (p.x - 100) * data[i],
    y: 30 + (p.y - 30) * data[i],
  }));
  const pathD = dataPoints.map((p, i) => (i === 0 ? "M" : "L") + ` ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg viewBox="0 0 200 60" className="w-full h-full">
      {[0.3, 0.6, 1].map((scale, i) => (
        <polygon
          key={i}
          points={points.map((p) => `${100 + (p.x - 100) * scale},${30 + (p.y - 30) * scale}`).join(" ")}
          fill="none"
          stroke="#ece7dc"
          strokeWidth="0.8"
          opacity={0.5 + i * 0.15}
        />
      ))}
      {points.map((p, i) => (
        <line key={i} x1="100" y1="30" x2={p.x} y2={p.y} stroke="#ece7dc" strokeWidth="0.8" opacity="0.4" />
      ))}
      <path
        d={pathD}
        fill="#FF662B"
        opacity="0.12"
        stroke="#FF662B"
        strokeWidth="1.2"
        style={{ animation: isActive ? "dz-float 4s ease-in-out infinite" : "none" }}
      />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#FF662B" />
      ))}
    </svg>
  );
}

const visualMap: Record<string, React.FC<{ isActive: boolean }>> = {
  constraint: ConstraintVisual,
  agent: AgentVisual,
  queue: QueueVisual,
  weather: WeatherVisual,
  preference: PreferenceVisual,
  explain: ExplainVisual,
};

// ========== 全屏项目详情弹窗 ==========
function ProjectDetailModal({ onClose }: { onClose: () => void }) {
  const [expandedHighlight, setExpandedHighlight] = useState<string | null>(null);

  const highlights = [
    {
      category: "架构",
      items: [
        {
          icon: Link2,
          title: "约束账本",
          desc: "每条约束从发现、落地、校验到解释全程可追溯，像一本清晰的旅行手账。",
          detail: "传统推荐系统像一个黑盒，用户不知道为什么会收到这些推荐。我们为每一条用户意图建立'约束账本'——记录约束的来源、可信度、状态和影响。每个 Agent 都能读取和更新这本账，确保所有决策基于同一套事实。",
        },
        {
          icon: Bot,
          title: "七维协作",
          desc: "7 个 Agent 各司其职，主链路仅 2-3 次 LLM 调用，其余由确定性工具完成。",
          detail: "单一模型很难同时做好理解、规划、检索、校验。七个 Agent 组成专业团队：InteractionRouter 分流、ConstraintDiscovery 拆约束、UserPreference 读偏好、ContextGrounding 调 provider、PlanSolver 生成候选、PlanEvaluator 打分排序、PlanExplanation 生成文案。各司其职，一气呵成。",
        },
        {
          icon: GitGraph,
          title: "LangGraph 状态图",
          desc: "支持中途补充约束、锁定 POI、换方向等动态调整，不是一次性黑盒。",
          detail: "用户会中途补充约束、锁定某个 POI、换城市或换时间。LangGraph 状态图让系统能局部重跑而非全量重来。ConstraintDiscovery -> ContextGrounding -> Solver -> Evaluator，每个节点都可条件跳转和重试。",
        },
      ],
    },
    {
      category: "智能",
      items: [
        {
          icon: Clock,
          title: "时间先知",
          desc: "结合实时排队与到达预测，在规划阶段就预判等待情况，温柔建议更好时间点。",
          detail: "最破坏心情的不是路程远，而是到了才发现要排两小时队。结合实时排队数据与到达时间预测，在规划阶段就预判每个目的地的等待情况。如果某处太拥挤，系统会温柔地建议更好的时间点或替代选择。",
        },
        {
          icon: CloudRain,
          title: "因天制宜",
          desc: "实时感知降水、温度、交通，雨天优先室内，晴天拥抱户外，四种方式实时对比。",
          detail: "天气变了计划没变，这是多少出行遗憾的源头。实时感知降水概率、温度、交通状况。雨天优先室内路线，晴天推荐户外漫步。地铁、驾车、骑行、步行四种方式实时对比，给出最适合当下的建议。",
        },
        {
          icon: Lightbulb,
          title: "愈用愈懂",
          desc: "从每次输入、选择和微调中学习，系统会记住你的偏好，下次默默考虑。",
          detail: "每次都要重新说明'我不吃辣'、'我喜欢安静的地方'，这种重复让人疲惫。从你的一次次输入、选择和微调中学习。喜欢川菜？偏好安静？厌倦排队？系统会记住，并在下次推荐时默默考虑。",
        },
        {
          icon: UserCircle,
          title: "UGC 偏好提取",
          desc: "从用户历史评论中提取长期偏好，比如'喜欢吃辣'，形成个性化约束。",
          detail: "用户以前写过的评论、打过的分、收藏过的店，都是偏好的信号。UserPreferenceAgent 会从 UGC 语料中提取关键词，形成长期偏好档案。比如用户说过'这家很辣很过瘾'，系统就会记住他喜欢吃辣。",
        },
      ],
    },
    {
      category: "体验",
      items: [
        {
          icon: Route,
          title: "无缝嵌入，智能分流",
          desc: "深度嵌入大众点评点仔，自动判断是路线规划还是普通 POI 问答，走不同链路。",
          detail: "不是独立应用，是对现有'点仔'的 AI 升级。用户输入'附近有什么咖啡'走普通问答链路；输入'下午两个人约会'走完整规划链路。InteractionRouterAgent 自动判断，用户无需手动切换模式。",
        },
        {
          icon: Layers,
          title: "内容块理念",
          desc: "拒绝大段文字，每个 Agent 步骤都是模块化内容块，右侧指示器自动吸附定位。",
          detail: "传统 LLM 给用户一大段文字，上下滑动很难找到重点。我们把每个 Agent 步骤都变成模块化内容块：补全卡片、需求确认、方案卡片、POI 详情。右侧指示器显示当前步骤，用户随时能回看之前的内容块。",
        },
        {
          icon: LayoutGrid,
          title: "卡片化方案",
          desc: "Plan 方案、确认卡片全部模块化渲染，AI 返回固定字段，前端分层展示。",
          detail: "AI 返回结构化 JSON，前端按字段分层渲染：方案标题、时间线、POI 卡片、推荐理由、风险提示。不是纯文本堆砌，而是有层次、可交互的卡片组合。用户可以直接在卡片上操作：锁定、替换、查看详情。",
        },
        {
          icon: MessageSquareText,
          title: "结构化追问",
          desc: "选择题、单选卡片、选择器，让用户反馈标准化，阻塞字段必须回答，偏好可默认。",
          detail: "开放式输入对 AI 和用户都累。我们把追问变成结构化卡片：城市选择器、人数步进器、是否吃喝单选、预算滑块、口味多选。阻塞字段（城市、时间、人数、是否吃喝）必须回答；偏好字段（预算、口味、交通）可默认跳过。",
        },
      ],
    },
    {
      category: "可信",
      items: [
        {
          icon: Eye,
          title: "明明白白",
          desc: "每个决策附带完整解释链路，右侧 Debug Trace 可回放整个 Agent 思考过程。",
          detail: "AI 推荐的信任危机来自'它为什么这么推荐？'这个无法回答的问题。每个推荐决策都附带完整解释：为什么选 A 不选 B、哪些约束被满足、评分如何拆解。右侧 Debug Trace 面板可以回放整个 Agent 思考过程。",
        },
        {
          icon: ShieldCheck,
          title: "算法校验",
          desc: "营业状态、交通条件由确定性工具校验，不是 LLM 猜测，硬约束必须满足。",
          detail: "LLM 不能凭空判断坐标、距离、营业状态和排队人数。PlanEvaluatorAgent 用确定性工具校验：到达时是否营业？交通时间是否合理？预算是否超支？硬约束（时间窗、人数、是否吃喝）必须满足，违反直接淘汰。",
        },
        {
          icon: Database,
          title: "真实 API + Mock",
          desc: "高德地图、彩云天气真实接入，其他数据由 AI Mock 生成器补齐，fallback 可追溯。",
          detail: "V3 优先接真实 provider：高德地图提供坐标和路线、彩云天气提供降水预测、LongCat LLM 提供理解能力。排队、UGC、推荐菜等深度数据暂时 Mock，但 MockDataAgent 能生成逼真的用户/POI/UGC，且 fallback 原因写入 Trace。",
        },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl m-4"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "dz-modal-in 0.3s ease-out" }}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-8">
          {/* 头部 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Image
                src="/dianping-assets/点仔Logo.png"
                alt="点仔"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div>
                <h2 className="text-2xl font-black text-neutral-900">DZUltra</h2>
                <p className="text-sm text-dz-orange font-semibold">点仔 Ultra</p>
              </div>
            </div>
            <p className="text-sm text-neutral-500 leading-relaxed">
              面向大众点评「点仔」的 AI 本地路线智能规划升级方案。用户出行多 POI 串联决策成本高，
              我们设计了一套 7 Agent 协作系统，自动生成多维度最优路线。
            </p>
          </div>

          {/* 核心亮点 */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-dz-orange mb-4">
              核心亮点
            </h3>
            <div className="space-y-4">
              {highlights.map((group) => (
                <div key={group.category}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-dz-orange/10 px-2 py-0.5 text-[10px] font-bold text-dz-orange">
                      {group.category}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isExpanded = expandedHighlight === item.title;
                      return (
                        <div
                          key={item.title}
                          className="rounded-xl bg-neutral-50 p-3 cursor-pointer transition-all hover:bg-neutral-100"
                          onClick={() => setExpandedHighlight(isExpanded ? null : item.title)}
                        >
                          <div className="flex gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                              <Icon className="h-4 w-4 text-dz-orange" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-bold text-neutral-900">{item.title}</div>
                                <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                              </div>
                              <div className="text-xs text-neutral-500 leading-relaxed mt-0.5">{item.desc}</div>
                            </div>
                          </div>
                          {/* 展开详情 */}
                          <div
                            className="overflow-hidden transition-all duration-300"
                            style={{
                              maxHeight: isExpanded ? "200px" : "0px",
                              opacity: isExpanded ? 1 : 0,
                              marginTop: isExpanded ? "12px" : "0px",
                            }}
                          >
                            <div className="rounded-lg bg-white p-3 text-xs text-neutral-600 leading-relaxed">
                              {item.detail}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 人员分工 */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-dz-orange mb-4">
              团队分工
            </h3>
            <div className="space-y-4">
              <div className="flex gap-4 rounded-xl bg-neutral-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dz-orange/10 text-dz-orange font-bold text-sm">
                  周
                </div>
                <div>
                  <div className="text-sm font-bold text-neutral-900">周鸿铭</div>
                  <p className="text-xs text-neutral-500 leading-relaxed mt-1">
                    负责后端架构与 Agent 策略，包括 FastAPI 服务、多 Agent 状态图、地图/天气/LLM provider 接入及 Mock 数据体系；同时参与前端设计。
                  </p>
                </div>
              </div>
              <div className="flex gap-4 rounded-xl bg-neutral-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dz-orange/10 text-dz-orange font-bold text-sm">
                  王
                </div>
                <div>
                  <div className="text-sm font-bold text-neutral-900">王涵琪</div>
                  <p className="text-xs text-neutral-500 leading-relaxed mt-1">
                    负责前端体验，包括 Next.js 移动端 UI、结构化追问、方案展示、Debug Trace 与交互设计。
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-dz-orange/20 bg-dz-orange/5 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-dz-orange mb-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  共同完成
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  产品定义、Figma/Pencil 原型设计与 Prompt 调优
                </p>
              </div>
            </div>
          </div>

          {/* 团队信息 */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-dz-orange mb-4">
              团队信息
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-neutral-400" />
                <span className="text-xs text-neutral-500">团队名称</span>
                <span className="text-sm font-bold text-neutral-900">MarKris</span>
              </div>
              <div className="flex items-center gap-3">
                <Trophy className="h-4 w-4 text-neutral-400" />
                <span className="text-xs text-neutral-500">参赛赛道</span>
                <span className="text-sm font-bold text-neutral-900">proposition-5</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-neutral-400" />
                <span className="text-xs text-neutral-500">联系邮箱</span>
              </div>
              <div className="ml-7 space-y-1">
                <a href="mailto:zhou.hongming@outlook.com" className="block text-xs text-dz-orange hover:underline">
                  zhou.hongming@outlook.com
                </a>
                <a href="mailto:wangh7krisy@outlook.com" className="block text-xs text-dz-orange hover:underline">
                  wangh7krisy@outlook.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== 单张卡片组件 ==========
function FeatureCard({
  card,
  isActive,
  onClick,
}: {
  card: (typeof cards)[number];
  isActive: boolean;
  onClick: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const Visual = visualMap[card.id];

  const handleClick = () => {
    if (!isActive) {
      onClick();
      return;
    }
    if (card.detail) {
      setShowDetail((prev) => !prev);
    }
  };

  return (
    <div
      className={`relative flex shrink-0 flex-col overflow-hidden rounded-2xl border transition-all duration-500 ${
        isActive
          ? "border-white/40 opacity-100 scale-100"
          : "border-white/20 opacity-50 scale-[0.94]"
      }`}
      style={{
        width: "400px",
        height: "140px",
        background: "rgba(255, 255, 255, 0.72)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: isActive
          ? "0 8px 32px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.5)"
          : "0 2px 8px rgba(0, 0, 0, 0.04)",
        cursor: isActive ? "pointer" : "default",
      }}
      onClick={handleClick}
    >
      {/* 正面 */}
      <div
        className="absolute inset-0 flex flex-col p-4 transition-opacity duration-300"
        style={{ opacity: showDetail ? 0 : 1, pointerEvents: showDetail ? "none" : "auto" }}
      >
        <div className="flex items-start justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-dz-orange">
            {card.eyebrow}
          </div>
        </div>

        <div className="mt-1 text-base font-extrabold tracking-tight text-neutral-900 leading-tight">
          {card.title}
        </div>

        <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 line-clamp-2">
          {card.desc}
        </p>

        <div className="mt-auto flex items-end justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-dz-orange/10 px-2 py-0.5 text-[10px] font-bold text-dz-orange">
              {card.tag}
            </span>
          </div>
          <div className="h-11 w-24">
            {Visual && <Visual isActive={isActive} />}
          </div>
        </div>
      </div>

      {/* 背面详情 */}
      {card.detail && (
        <div
          className="absolute inset-0 flex flex-col p-4 transition-opacity duration-300"
          style={{ opacity: showDetail ? 1 : 0, pointerEvents: showDetail ? "auto" : "none" }}
        >
          <div className="flex items-center gap-1 text-[11px] font-medium text-dz-orange/70 mb-1">
            <ArrowLeft className="h-3 w-3" />
            再次点击返回
          </div>

          <div className="text-sm font-extrabold text-neutral-900 leading-tight">
            {card.title}
          </div>

          <div className="relative mt-2 flex-1 overflow-y-auto space-y-1.5">
            <div>
              <div className="text-[10px] font-bold text-neutral-700">为什么</div>
              <p className="text-[10px] leading-snug text-neutral-600">{card.detail.why}</p>
            </div>
            <div>
              <div className="text-[10px] font-bold text-neutral-700">怎么做</div>
              <p className="text-[10px] leading-snug text-neutral-600">{card.detail.how}</p>
            </div>
            <div>
              <div className="text-[10px] font-bold text-neutral-700">带来什么</div>
              <p className="text-[10px] leading-snug text-neutral-600">{card.detail.what}</p>
            </div>
            <div
              className="sticky bottom-0 left-0 right-0 h-6 pointer-events-none"
              style={{
                background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.85))"
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 主组件 ==========
export function ProjectIntroBar() {
  const introCollapsed = useDemoStore((state) => state.introCollapsed);
  const setIntroCollapsed = useDemoStore((state) => state.setIntroCollapsed);

  const [current, setCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [showProjectDetail, setShowProjectDetail] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastWheelTime = useRef(0);
  const accumulatedDelta = useRef(0);

  const cardWidth = 400;
  const gap = 14;

  const goTo = useCallback((index: number) => {
    setCurrent(Math.max(0, Math.min(cards.length - 1, index)));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    accumulatedDelta.current = 0;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - startX;
    setTranslateX(delta);
    accumulatedDelta.current = delta;
  };
  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const totalDelta = accumulatedDelta.current;
    if (totalDelta < -40) goTo(current + 1);
    else if (totalDelta > 40) goTo(current - 1);
    setTranslateX(0);
    accumulatedDelta.current = 0;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    accumulatedDelta.current = 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientX - startX;
    setTranslateX(delta);
    accumulatedDelta.current = delta;
  };
  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const totalDelta = accumulatedDelta.current;
    if (totalDelta < -30) goTo(current + 1);
    else if (totalDelta > 30) goTo(current - 1);
    setTranslateX(0);
    accumulatedDelta.current = 0;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();

        const now = Date.now();
        const timeSinceLastWheel = now - lastWheelTime.current;
        lastWheelTime.current = now;

        if (timeSinceLastWheel > 300) {
          accumulatedDelta.current = 0;
        }

        accumulatedDelta.current += e.deltaX;

        if (accumulatedDelta.current > 60) {
          goTo(current - 1);
          accumulatedDelta.current = 0;
        } else if (accumulatedDelta.current < -60) {
          goTo(current + 1);
          accumulatedDelta.current = 0;
        }
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [current, goTo]);

  const offset = -current * (cardWidth + gap) + translateX;

  // 折叠态
  if (introCollapsed) {
    return (
      <div className="flex min-h-[72px] flex-wrap items-center gap-x-5 gap-y-2 border-b border-dz-line bg-white px-6 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Image
              src="/dianping-assets/点仔Logo.png"
              alt="点仔"
              width={20}
              height={20}
              className="rounded-sm"
            />
            <span className="text-sm font-semibold text-dz-orange">DZUltra</span>
            <span className="text-sm font-black text-dz-ink">点仔 Ultra</span>
            <span className="text-xs text-neutral-500">作者：{authors.join("、")}</span>
            <span className="text-xs font-medium bg-gradient-to-r from-[#56A4F0] via-[#7555DE] via-[#9577E2] to-[#EA80D2] bg-clip-text text-transparent">
              {eventLine}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            面向大众点评点仔的 AI 本地路线智能规划：真实 Provider 调用、可解释推荐、右侧 Debug Trace 回放。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIntroCollapsed(false)}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-dz-line bg-white px-3 py-1.5 text-xs font-bold text-neutral-500 hover:border-dz-orange hover:text-dz-orange"
        >
          展开介绍
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="relative border-b border-dz-line bg-white" style={{ maxHeight: "32vh", overflow: "hidden" }}>
        {/* 右上角固定收起按钮 */}
        <button
          onClick={() => setIntroCollapsed(true)}
          className="absolute right-4 top-3 z-20 flex items-center gap-1 rounded-full bg-dz-orange px-2.5 py-1 text-[10px] font-medium text-white shadow-sm transition hover:bg-dz-orange/90"
          style={{ animation: "dz-bounce-in 2s ease-in-out 3s 1" }}
        >
          收起
          <ChevronUp className="h-3 w-3" />
        </button>

        {/* 顶部标题栏 */}
        <div className="px-6 pt-3 pr-20">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-dz-orange">DZUltra</p>
              <span className="text-xs font-medium text-neutral-500">作者：{authors.join("、")}</span>
              <span className="text-xs font-medium bg-gradient-to-r from-[#56A4F0] via-[#7555DE] via-[#9577E2] to-[#EA80D2] bg-clip-text text-transparent">
                {eventLine}
              </span>
            </div>
            <h1 className="mt-0.5 text-lg font-black tracking-tight">
              点仔 Ultra —— 懂约束、会追问的路线助手｜大众点评 AI 本地路线规划焕新升级方案
            </h1>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              用户出行多 POI 串联决策成本高 → 7 Agent 协作自动生成多维度最优路线
            </p>
          </div>
        </div>

        {/* 提示文字 */}
        <div className="pt-2 pb-1 text-center text-[11px] text-neutral-400">
          ← 拖拽、滑动或点击查看详情 →
        </div>

        {/* 轮播区 - 项目介绍卡片固定，能力卡片可滑动 */}
        <div className="relative flex items-center gap-3.5 px-6 pb-3">
          {/* 左侧项目介绍卡片 - 固定不动，毛玻璃风格 */}
          <div
            className="relative z-10 flex shrink-0 flex-col overflow-hidden rounded-2xl border border-white/30 transition-all duration-500 cursor-pointer hover:shadow-lg hover:border-white/50"
            style={{
              width: "140px",
              height: "140px",
              background: "rgba(255, 255, 255, 0.75)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.5)",
            }}
            onClick={() => setShowProjectDetail(true)}
          >
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <div className="text-sm font-extrabold text-neutral-900 leading-tight">
                项目介绍
              </div>
              <p className="mt-2 text-[10px] leading-snug text-neutral-500">
                点击了解详情
              </p>
              <div className="mt-2 text-[9px] text-dz-orange font-medium">
                团队 · 亮点 · 分工 →
              </div>
            </div>
          </div>

          {/* 左箭头 - 放在项目介绍左侧 */}
          <button
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
              current === 0
                ? "bg-neutral-100 text-neutral-300 cursor-not-allowed"
                : "bg-white/80 text-neutral-600 hover:bg-white shadow-sm backdrop-blur-sm"
            }`}
          >
            <ChevronDown className="h-4 w-4 rotate-90" />
          </button>

          {/* 可滑动区域 */}
          <div
            className="relative flex-1 overflow-hidden"
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
          >
            <div
              className="flex items-center gap-3.5"
              style={{
                transform: `translateX(${offset}px)`,
                transition: isDragging ? "none" : "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {/* 能力卡片 */}
              {cards.map((card, index) => (
                <FeatureCard
                  key={card.id}
                  card={card}
                  isActive={index === current}
                  onClick={() => goTo(index)}
                />
              ))}
            </div>
          </div>

          {/* 右箭头 - 放在滑动区域右侧 */}
          <button
            onClick={() => goTo(current + 1)}
            disabled={current === cards.length - 1}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
              current === cards.length - 1
                ? "bg-neutral-100 text-neutral-300 cursor-not-allowed"
                : "bg-white/80 text-neutral-600 hover:bg-white shadow-sm backdrop-blur-sm"
            }`}
          >
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </button>
        </div>

        {/* 指示器 */}
        <div className="flex justify-center gap-1.5 pb-1.5">
          {cards.map((_, index) => (
            <button
              key={index}
              className={`h-1 rounded-full transition-all duration-300 ${
                index === current ? "w-4 bg-dz-orange" : "w-1 bg-dz-line"
              }`}
              onClick={() => goTo(index)}
              aria-label={`Slide ${index + 1}`}
            />
          ))}
        </div>

        {/* 底部 hover 显现收起按钮 */}
        <div className="group relative flex justify-center pb-2">
          <button
            onClick={() => setIntroCollapsed(true)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] text-neutral-400 opacity-0 transition-all duration-300 hover:bg-neutral-100 hover:text-neutral-600 group-hover:opacity-100"
          >
            收起介绍
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* 全屏项目详情弹窗 */}
      {showProjectDetail && (
        <ProjectDetailModal onClose={() => setShowProjectDetail(false)} />
      )}
    </>
  );
}

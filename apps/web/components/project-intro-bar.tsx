"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { useDemoStore } from "@/stores/use-demo-store";
import Image from "next/image";

const authors = ["周鸿铭", "王涵琪"];
const eventLine = "美团 2026 AI Hackthon 大赛 赛题5「现在就出发：AI本地路线智能规划」";

// ========== 卡片数据（Apple 风文案，只讲优点） ==========
const cards = [
  {
    id: "constraint",
    eyebrow: "架构创新",
    title: "约束账本",
    desc: "你的每一个需求都会被认真对待。从发现到解释，全程透明可追溯。",
    tag: "透明可信",
    hint: "全程可追溯",
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
    hint: "LangGraph 驱动",
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
    hint: "到达即享",
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
    hint: "全场景覆盖",
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
    hint: "记忆你的喜欢",
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
    hint: "Debug Trace 回放",
    detail: {
      why: "AI 推荐的信任危机，往往来自'它为什么这么推荐？'这个无法回答的问题。",
      how: "每个推荐决策都附带完整的解释链路：为什么选 A 不选 B、哪些约束被满足、哪些被权衡、评分如何拆解。右侧 Debug Trace 面板可以回放整个思考过程。",
      what: "你不需要相信一个黑盒。你可以看懂每一个决定，因为一切都摊开在阳光下。",
    },
  },
];

// ========== SVG 几何动画组件（适配小卡片） ==========

function ConstraintVisual({ isActive }: { isActive: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <defs>
        <linearGradient id="chainGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffd84d" />
          <stop offset="50%" stopColor="#FF662B" />
          <stop offset="100%" stopColor="#ffd84d" />
        </linearGradient>
      </defs>
      <path
        d="M 15 40 Q 38 20, 60 40 T 105 40"
        fill="none"
        stroke="url(#chainGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="8 5"
        style={{ animation: isActive ? "dz-dash-flow 2s linear infinite" : "none" }}
      />
      {[
        { x: 15, y: 40 },
        { x: 42, y: 28 },
        { x: 78, y: 28 },
        { x: 105, y: 40 },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="7" fill="#fff5eb" stroke="#FF662B" strokeWidth="1" />
          <circle
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#FF662B"
            style={{ animation: isActive ? `dz-dot-pulse 2s ease-in-out ${i * 0.3}s infinite` : "none" }}
          />
        </g>
      ))}
    </svg>
  );
}

function AgentVisual({ isActive }: { isActive: boolean }) {
  const center = { x: 60, y: 40 };
  const nodes = [
    { x: 60, y: 12 },
    { x: 28, y: 28 },
    { x: 92, y: 28 },
    { x: 36, y: 58 },
    { x: 84, y: 58 },
    { x: 60, y: 68 },
  ];
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      {nodes.map((n, i) => (
        <line key={i} x1={center.x} y1={center.y} x2={n.x} y2={n.y} stroke="#ece7dc" strokeWidth="1" />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="6" fill="#fff5eb" />
          <circle
            cx={n.x}
            cy={n.y}
            r="2.5"
            fill="#FF662B"
            style={{ animation: isActive ? `dz-dot-pulse 2s ease-in-out ${i * 0.25}s infinite` : "none" }}
          />
        </g>
      ))}
      <circle cx={center.x} cy={center.y} r="10" fill="#FF662B" opacity="0.1" />
      <circle cx={center.x} cy={center.y} r="5" fill="#FF662B" />
    </svg>
  );
}

function QueueVisual({ isActive }: { isActive: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <defs>
        <radialGradient id="queueGrad" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#FF662B" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#FF662B" stopOpacity="0" />
        </radialGradient>
      </defs>
      <line x1="15" y1="68" x2="105" y2="68" stroke="#ece7dc" strokeWidth="1.5" strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={25 + i * 27} cy="68" r="2.5" fill={i === 2 ? "#FF662B" : "#ece7dc"} />
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx="60"
          cy="34"
          r={12 + i * 12}
          fill="none"
          stroke="#FF662B"
          strokeWidth="1"
          opacity="0.2"
          style={{
            animation: isActive ? `dz-pulse-ring 2.5s ease-out ${i * 0.6}s infinite` : "none",
            transformOrigin: "60px 34px",
          }}
        />
      ))}
      <circle cx="60" cy="34" r="10" fill="url(#queueGrad)" />
      <circle cx="60" cy="34" r="6" fill="#FF662B" />
    </svg>
  );
}

function WeatherVisual({ isActive }: { isActive: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <path
        d="M 15 60 Q 45 24, 60 40 T 102 20"
        fill="none"
        stroke="#ece7dc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="5 4"
      />
      <path
        d="M 15 60 Q 45 24, 60 40 T 102 20"
        fill="none"
        stroke="#FF662B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="5 4"
        style={{ animation: isActive ? "dz-dash-flow 2s linear infinite" : "none" }}
      />
      <circle cx="15" cy="60" r="5" fill="#FF662B" />
      <circle cx="102" cy="20" r="5" fill="#ffd84d" />
      <g style={{ animation: isActive ? "dz-float 3s ease-in-out infinite" : "none" }}>
        <ellipse cx="85" cy="52" rx="12" ry="7" fill="#e8f4fd" />
        <ellipse cx="92" cy="48" rx="9" ry="6" fill="#e8f4fd" />
        {[81, 87, 93].map((x, i) => (
          <line
            key={i}
            x1={x}
            y1="56"
            x2={x - 1}
            y2="62"
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
    { x: 20, y: 64, h: 12 },
    { x: 44, y: 56, h: 20 },
    { x: 68, y: 44, h: 32 },
    { x: 92, y: 28, h: 48 },
  ];
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <line x1="10" y1="68" x2="110" y2="68" stroke="#ece7dc" strokeWidth="1.5" />
      {steps.map((s, i) => (
        <g key={i}>
          <rect
            x={s.x - 8}
            y={s.y - s.h}
            width="16"
            height={s.h}
            rx="3"
            fill={i === 3 ? "#FF662B" : "#fff5eb"}
            opacity={i === 3 ? 0.9 : 0.7}
            style={{ animation: isActive ? `dz-float 3s ease-in-out ${i * 0.2}s infinite` : "none" }}
          />
        </g>
      ))}
      <path
        d="M 24 56 Q 60 16, 96 24"
        fill="none"
        stroke="#FF662B"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="4 3"
        style={{ animation: isActive ? "dz-dash-flow 3s linear infinite" : "none" }}
      />
      <polygon points="93,22 98,24 95,28" fill="#FF662B" />
    </svg>
  );
}

function ExplainVisual({ isActive }: { isActive: boolean }) {
  const points = [
    { x: 60, y: 12 },
    { x: 95, y: 32 },
    { x: 82, y: 72 },
    { x: 38, y: 72 },
    { x: 25, y: 32 },
  ];
  const data = [0.92, 0.78, 0.88, 0.72, 0.96];
  const dataPoints = points.map((p, i) => ({
    x: 60 + (p.x - 60) * data[i],
    y: 40 + (p.y - 40) * data[i],
  }));
  const pathD = dataPoints.map((p, i) => (i === 0 ? "M" : "L") + ` ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      {[0.3, 0.6, 1].map((scale, i) => (
        <polygon
          key={i}
          points={points.map((p) => `${60 + (p.x - 60) * scale},${40 + (p.y - 40) * scale}`).join(" ")}
          fill="none"
          stroke="#ece7dc"
          strokeWidth="0.8"
          opacity={0.5 + i * 0.15}
        />
      ))}
      {points.map((p, i) => (
        <line key={i} x1="60" y1="40" x2={p.x} y2={p.y} stroke="#ece7dc" strokeWidth="0.8" opacity="0.4" />
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
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#FF662B" />
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

// ========== 单张卡片组件（支持正反翻转） ==========
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
      setShowDetail(true);
    }
  };

  return (
    <div
      className={`relative flex shrink-0 flex-col overflow-hidden rounded-xl border bg-white transition-all duration-500 ${
        isActive
          ? "border-dz-line/60 opacity-100"
          : "border-dz-line/30 opacity-50 scale-[0.96]"
      }`}
      style={{
        width: "210px",
        height: "130px",
        boxShadow: isActive
          ? "0 4px 16px rgba(255, 102, 43, 0.08), 0 1px 4px rgba(0,0,0,0.04)"
          : "0 1px 4px rgba(0,0,0,0.02)",
        cursor: isActive ? "pointer" : "default",
      }}
      onClick={handleClick}
    >
      {/* 正面 */}
      <div
        className="absolute inset-0 flex flex-col p-3 transition-opacity duration-300"
        style={{ opacity: showDetail ? 0 : 1, pointerEvents: showDetail ? "none" : "auto" }}
      >
        {/* 顶部 */}
        <div className="flex items-start justify-between">
          <div className="text-[9px] font-bold uppercase tracking-wider text-dz-orange">
            {card.eyebrow}
          </div>
          <Image
            src="/dianping-assets/点仔Logo.png"
            alt="点仔"
            width={16}
            height={16}
            className="rounded-sm opacity-40"
          />
        </div>

        {/* 标题 */}
        <div className="mt-0.5 text-sm font-extrabold tracking-tight text-neutral-900 leading-tight">
          {card.title}
        </div>

        {/* 描述 */}
        <p className="mt-1 text-[10px] leading-snug text-neutral-500 line-clamp-2">
          {card.desc}
        </p>

        {/* 底部视觉 */}
        <div className="mt-auto flex items-end justify-between">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-dz-soft px-1.5 py-0.5 text-[8px] font-bold text-dz-orange">
              {card.tag}
            </span>
            <span className="text-[8px] text-neutral-400">{card.hint}</span>
          </div>
          <div className="h-10 w-14">
            {Visual && <Visual isActive={isActive} />}
          </div>
        </div>
      </div>

      {/* 背面详情 */}
      {card.detail && (
        <div
          className="absolute inset-0 flex flex-col p-3 transition-opacity duration-300"
          style={{ opacity: showDetail ? 1 : 0, pointerEvents: showDetail ? "auto" : "none" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 返回按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetail(false);
            }}
            className="flex items-center gap-0.5 text-[9px] font-medium text-dz-orange hover:text-dz-orange/80 transition-colors mb-1"
          >
            <ArrowLeft className="h-2.5 w-2.5" />
            返回
          </button>

          {/* 标题 */}
          <div className="text-[10px] font-extrabold text-neutral-900 leading-tight">
            {card.title}
          </div>

          {/* 详情内容 */}
          <div className="mt-1 flex-1 overflow-y-auto space-y-1">
            <div>
              <div className="text-[8px] font-bold text-neutral-700">为什么</div>
              <p className="text-[8px] leading-tight text-neutral-500">{card.detail.why}</p>
            </div>
            <div>
              <div className="text-[8px] font-bold text-neutral-700">怎么做</div>
              <p className="text-[8px] leading-tight text-neutral-500">{card.detail.how}</p>
            </div>
            <div>
              <div className="text-[8px] font-bold text-neutral-700">带来什么</div>
              <p className="text-[8px] leading-tight text-neutral-500">{card.detail.what}</p>
            </div>
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
  const containerRef = useRef<HTMLDivElement>(null);
  const lastWheelTime = useRef(0);
  const accumulatedDelta = useRef(0);

  const cardWidth = 210;
  const gap = 12;

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
    if (totalDelta < -60) goTo(current + 1);
    else if (totalDelta > 60) goTo(current - 1);
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
    if (totalDelta < -40) goTo(current + 1);
    else if (totalDelta > 40) goTo(current - 1);
    setTranslateX(0);
    accumulatedDelta.current = 0;
  };

  // 触控板滑动：使用节流 + 累积阈值，防止轻滑不动、多滑跳多张
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();

        const now = Date.now();
        const timeSinceLastWheel = now - lastWheelTime.current;
        lastWheelTime.current = now;

        // 如果两次 wheel 间隔超过 300ms，重置累积值
        if (timeSinceLastWheel > 300) {
          accumulatedDelta.current = 0;
        }

        accumulatedDelta.current += e.deltaX;

        // 累积超过阈值才切换，且每次只切换一张
        if (accumulatedDelta.current > 80) {
          goTo(current - 1);
          accumulatedDelta.current = 0;
        } else if (accumulatedDelta.current < -80) {
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
      <div className="flex min-h-[72px] flex-wrap items-center gap-x-5 gap-y-2 border-b border-dz-line bg-white/88 px-6 py-3 backdrop-blur-sm">
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
    <div className="border-b border-dz-line bg-white/80 backdrop-blur-sm">
      {/* 顶部标题栏 */}
      <div className="px-6 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-dz-orange">DZUltra</p>
            <span className="text-xs font-medium text-neutral-500">作者：{authors.join("、")}</span>
            <span className="text-xs font-medium bg-gradient-to-r from-[#56A4F0] via-[#7555DE] via-[#9577E2] to-[#EA80D2] bg-clip-text text-transparent">
              {eventLine}
            </span>
          </div>
          <h1 className="mt-1 text-xl font-black tracking-tight">
            点仔 Ultra —— 懂约束、会追问的路线助手｜大众点评 AI 本地路线规划焕新升级方案
          </h1>
          <p className="mt-1.5 text-xs leading-5 text-neutral-500">
            用户出行多 POI 串联决策成本高 → 7 Agent 协作自动生成多维度最优路线
          </p>
        </div>
      </div>

      {/* 轮播区 */}
      <div
        className="relative w-full overflow-hidden py-4"
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
          className="flex gap-3"
          style={{
            padding: "0 calc(50% - 105px)",
            transform: `translateX(${offset}px)`,
            transition: isDragging ? "none" : "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
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

      {/* 指示器 */}
      <div className="flex justify-center gap-1.5 pb-2">
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

      <div className="pb-2 text-center text-[10px] text-neutral-400">
        ← 拖拽或滑动探索更多 →
      </div>

      {/* 折叠按钮 */}
      <div className="flex justify-center pb-2">
        <button
          onClick={() => setIntroCollapsed(true)}
          className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-600"
        >
          收起介绍
          <ChevronUp className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

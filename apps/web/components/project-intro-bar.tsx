"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb, Link2, Bot, BarChart3, CloudSun, Brain, FileText } from "lucide-react";
import { useDemoStore } from "@/stores/use-demo-store";

const authors = ["周鸿铭", "王涵琪"];
const eventLine = "美团 2026 AI Hackthon 大赛 赛题5「现在就出发：AI本地路线智能规划」";

const coreHighlights = [
  { icon: Link2, title: "约束账本", desc: "所有推荐围绕约束发现→落地→校验→解释，每条约束可追溯来源和可信度" },
  { icon: Bot, title: "7 Agent 协作", desc: "LLM 负责理解和表达，工具负责事实和约束，主链路仅 2-3 次 LLM 调用" },
  { icon: BarChart3, title: "排队预测", desc: "结合到达时间预测等位，排队超阈值自动降权或排除" },
  { icon: CloudSun, title: "天气/交通感知", desc: "降水概率>60%优先室内，4 种交通方式实时对比" },
  { icon: Brain, title: "偏好持续学习", desc: "从输入、选择、微调中检测偏好，置信度+来源追踪+持久化" },
  { icon: FileText, title: "可解释推荐", desc: "每个方案和每个 POI 都有推荐理由、排除理由和评分拆解" },
];

const allHighlights = {
  "架构创新": [
    "约束账本 — 所有推荐围绕约束发现→落地→校验→解释",
    "7 Agent 协作管线 — LLM 负责理解和表达，工具负责事实",
    "Provider 降级体系 — 多层 fallback 保证演示稳定",
    "LangGraph 状态图 — 以状态机承接真实输入、补全、微调和切换任务",
  ],
  "数据智能": [
    "排队预测 — 结合到达时间预测等位",
    "天气约束 — 降水概率影响路线编排",
    "交通对比 — 4 种交通方式实时对比",
    "UGC 分析 — 评论语料进入候选筛选和解释",
    "偏好持续学习 — 从输入、选择、微调中检测偏好",
    "MockDataAgent 地理校验 — 坐标优先由 geocode 工具校验",
  ],
  "交互创新": [
    "页面上下文感知分流 — 结合页面状态和任务上下文判断交互类型",
    "结构化追问上限 — 最多 2 轮，阻塞字段才阻塞规划",
    "内容块导航 — 纵向内容块流 + 右侧节点指示器",
    "微调 Diff 追踪 — 精确变更追踪 + 锁定机制",
    "双链路设计 — 普通问答 vs 路线规划分流",
  ],
  "工程实践": [
    "可解释推荐 — 每个方案和 POI 都有推荐理由",
    "真实耗时与成本计量 — LLM span 展示模型、token、耗时和成本",
    "Provider 选型与字段映射 — 9 类 Provider 系统调研",
    "To-do 生态落地 — 方案可执行清单 + 生态操作入口",
    "多方案差异化生成 — Beam Search + 不同策略生成真正有差异的方案",
  ],
};

export function ProjectIntroBar() {
  const introCollapsed = useDemoStore((state) => state.introCollapsed);
  const setIntroCollapsed = useDemoStore((state) => state.setIntroCollapsed);
  const [showAllHighlights, setShowAllHighlights] = useState(false);

  if (introCollapsed) {
    return (
      <div className="flex min-h-[72px] flex-wrap items-center gap-x-5 gap-y-2 border-b border-dz-line bg-white/88 px-6 py-3 backdrop-blur-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-dz-orange">DZUltra</span>
            <span className="text-sm font-black text-dz-ink">点仔 Ultra</span>
            <span className="text-xs text-neutral-500">作者：{authors.join("、")}</span>
            <span className="text-xs font-medium bg-gradient-to-r from-[#56A4F0] via-[#7555DE] via-[#9577E2] to-[#EA80D2] bg-clip-text text-transparent">{eventLine}</span>
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
      <div className="px-6 pt-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-dz-orange">DZUltra</p>
            <span className="text-xs font-medium text-neutral-500">作者：{authors.join("、")}</span>
            <span className="text-xs font-medium bg-gradient-to-r from-[#56A4F0] via-[#7555DE] via-[#9577E2] to-[#EA80D2] bg-clip-text text-transparent">{eventLine}</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight">
            点仔 Ultra —— 懂约束、会追问的路线助手｜大众点评 AI 本地路线规划焕新升级方案
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            用户出行多 POI 串联决策成本高 → 7 Agent 协作自动生成多维度最优路线
          </p>

          {/* 6 张核心创新卡片 */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {coreHighlights.map((h) => (
              <div
                key={h.title}
                className="rounded-lg border border-dz-line bg-white/60 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <h.icon className="h-4 w-4 text-dz-orange" />
                  <span className="text-xs font-semibold">{h.title}</span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-neutral-500">{h.desc}</p>
              </div>
            ))}
          </div>

          {/* 操作指引 */}
          <div className="mt-3 flex items-center gap-4">
            <p className="text-xs text-neutral-400">
              试试输入：<span className="font-medium text-neutral-600">今天下午两个人在望京约会，少排队</span>
            </p>
            <button
              onClick={() => setShowAllHighlights(!showAllHighlights)}
              className="inline-flex items-center gap-1 text-xs text-dz-orange hover:underline"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {showAllHighlights ? "收起亮点" : "查看全部 20 条亮点"}
              {showAllHighlights ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {/* 全部亮点列表 */}
          {showAllHighlights && (
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-dz-line bg-white/40 p-4">
              {Object.entries(allHighlights).map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-1.5 text-xs font-bold text-neutral-700">{category}</h3>
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li key={i} className="text-[11px] leading-4 text-neutral-500">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 折叠按钮 */}
      <div className="flex justify-center pt-2 pb-1">
        <button
          onClick={() => setIntroCollapsed(true)}
          className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-600"
        >
          收起介绍
          <ChevronUp className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

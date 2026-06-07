import { MapPin } from "lucide-react";
import type { MapPoint } from "@/types/dzultra";

type SvgRouteMapProps = {
  points?: MapPoint[];
  tone?: "orange" | "blue" | "green";
  label?: string;
  summary?: string;
};

const toneConfig = {
  orange: {
    route: "#ff8a00",
    routeSoft: "#f2d084",
    pin: "#ffd84d"
  },
  blue: {
    route: "#3b82f6",
    routeSoft: "#bfdbfe",
    pin: "#dbeafe"
  },
  green: {
    route: "#16a34a",
    routeSoft: "#bbf7d0",
    pin: "#dcfce7"
  }
};

export function SvgRouteMap({
  points = [
    { x: 78, y: 142, label: "食" },
    { x: 190, y: 74, label: "展" },
    { x: 306, y: 156, label: "甜" }
  ],
  tone = "orange",
  label = "北京局部伪地图",
  summary = "平均排队 5.3 分钟"
}: SvgRouteMapProps) {
  const colors = toneConfig[tone];
  const routePath =
    points.length >= 3
      ? `M${points[0].x} ${points[0].y} C126 104, 150 88, ${points[1].x} ${points[1].y} S260 108, ${points[2].x} ${points[2].y}`
      : "M78 142 C126 104, 150 88, 190 74 S260 108, 306 156";

  return (
    <div className="rounded-2xl border border-dz-line bg-[#fffaf0] p-3">
      <svg viewBox="0 0 380 230" className="h-[210px] w-full" role="img" aria-label="点仔 Ultra SVG 伪地图">
        <path d="M20 46 C100 28, 136 132, 232 92 S310 150, 360 118" fill="none" stroke={colors.routeSoft} strokeWidth="18" strokeLinecap="round" />
        <path d="M48 194 C118 152, 176 188, 236 146 S308 86, 350 40" fill="none" stroke="#e9e1d1" strokeWidth="12" strokeLinecap="round" />
        <path d={routePath} fill="none" stroke={colors.route} strokeWidth="7" strokeLinecap="round" strokeDasharray="10 10" />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="21" fill="#171717" />
            <circle cx={point.x} cy={point.y} r="17" fill={colors.pin} />
            <text x={point.x} y={point.y + 6} textAnchor="middle" className="fill-dz-ink text-[15px] font-bold">
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-between text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-dz-orange" />
          {label}
        </span>
        <span>{summary}</span>
      </div>
    </div>
  );
}

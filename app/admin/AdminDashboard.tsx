"use client";

import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { 
  Users, 
  Eye, 
  Megaphone, 
  Send, 
  Clock, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  LineChart,
  BarChart2,
  Download,
  Flame,
  Activity,
  Sun,
  Moon,
  Sunset,
  Coffee,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

// Types
type TimeRange = "24h" | "7d" | "30d" | "90d";
type ChartType = "area" | "bar";
type MetricMode = "all" | "views" | "visitors";
type DashboardTab = "telemetry" | "broadcasts";

interface DailyViewPoint {
  date: string;
  views: number;
  visitors: number;
}

interface AdminStats {
  range: string;
  totalPageViews: number;
  uniqueVisitors: number;
  totalUsers: number;
  totalComments: number;
  viewsDeltaPct: number;
  visitorsDeltaPct: number;
  avgViewsPerVisitor: number;
  peakDate: string;
  peakViews: number;
  dayParts: {
    night: number;
    morning: number;
    afternoon: number;
    evening: number;
  };
  dailyViews: DailyViewPoint[];
  topPages: { path: string; views: number }[];
  topAnime: { animeId: string | null; title: string; views: number }[];
}

interface Broadcast {
  id: string;
  title: string;
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  createdAt: string;
}

// Smooth cubic Bezier path generator for SVG Area/Line curves
function getSmoothPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]},${points[0][1]}`;
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const mx = (x0 + x1) / 2;
    d += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("telemetry");
  const [range, setRange] = useState<TimeRange>("7d");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [metricMode, setMetricMode] = useState<MetricMode>("all");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const [showBroadcastConfirm, setShowBroadcastConfirm] = useState(false);
  const queryClient = useQueryClient();
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Fetch Stats
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<AdminStats>({
    queryKey: ["adminStats", range],
    queryFn: async () => {
      const res = await fetch(`/api/admin/stats?range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // Fetch Broadcasts History
  const {
    data: broadcastsData,
    isLoading: broadcastsLoading,
    isError: broadcastsError,
    refetch: refetchBroadcasts,
  } = useQuery<{ broadcasts: Broadcast[] }>({
    queryKey: ["adminBroadcasts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/broadcasts");
      if (!res.ok) throw new Error("Failed to fetch broadcasts");
      return res.json();
    },
  });

  // Send Broadcast Mutation
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "", linkUrl: "", linkLabel: "" });
  const [broadcastError, setBroadcastError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const sendBroadcast = useMutation({
    mutationFn: async (payload: typeof broadcastForm) => {
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send broadcast");
      }
      return res.json();
    },
    onSuccess: () => {
      setBroadcastForm({ title: "", message: "", linkUrl: "", linkLabel: "" });
      queryClient.invalidateQueries({ queryKey: ["adminBroadcasts"] });
      setIsSending(false);
    },
    onError: (err) => {
      setBroadcastError(err.message);
      setIsSending(false);
    }
  });

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title || !broadcastForm.message) return;
    setShowBroadcastConfirm(true);
  };

  const confirmSendBroadcast = () => {
    setShowBroadcastConfirm(false);
    setIsSending(true);
    setBroadcastError("");
    sendBroadcast.mutate(broadcastForm);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!stats?.dailyViews?.length) return;
    const header = "Date/Hour,Page Views,Unique Visitors\n";
    const rows = stats.dailyViews.map(d => `"${d.date}",${d.views},${d.visitors}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `wave-analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Chart Geometry & Calculations
  const chartData = useMemo(() => stats?.dailyViews || [], [stats?.dailyViews]);
  const maxMetricVal = useMemo(() => {
    if (!chartData.length) return 10;
    let m = 0;
    for (const d of chartData) {
      if (d.views > m) m = d.views;
      if (d.visitors > m) m = d.visitors;
    }
    return Math.max(m, 10);
  }, [chartData]);

  // Coordinates for SVG Chart
  const svgWidth = 960;
  const svgHeight = 220;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const viewsPoints = useMemo<[number, number][]>(() => {
    if (!chartData.length) return [];
    return chartData.map((d, i) => {
      const x = padLeft + (i / Math.max(chartData.length - 1, 1)) * plotWidth;
      const y = padTop + plotHeight - (d.views / maxMetricVal) * plotHeight;
      return [x, y];
    });
  }, [chartData, maxMetricVal, plotHeight, plotWidth]);

  const visitorsPoints = useMemo<[number, number][]>(() => {
    if (!chartData.length) return [];
    return chartData.map((d, i) => {
      const x = padLeft + (i / Math.max(chartData.length - 1, 1)) * plotWidth;
      const y = padTop + plotHeight - (d.visitors / maxMetricVal) * plotHeight;
      return [x, y];
    });
  }, [chartData, maxMetricVal, plotHeight, plotWidth]);

  const viewsLinePath = useMemo(() => getSmoothPath(viewsPoints), [viewsPoints]);
  const visitorsLinePath = useMemo(() => getSmoothPath(visitorsPoints), [visitorsPoints]);

  const viewsAreaPath = useMemo(() => {
    if (!viewsPoints.length) return "";
    const baseY = padTop + plotHeight;
    return `${viewsLinePath} L ${viewsPoints[viewsPoints.length - 1][0]},${baseY} L ${viewsPoints[0][0]},${baseY} Z`;
  }, [viewsLinePath, viewsPoints, plotHeight]);

  const visitorsAreaPath = useMemo(() => {
    if (!visitorsPoints.length) return "";
    const baseY = padTop + plotHeight;
    return `${visitorsLinePath} L ${visitorsPoints[visitorsPoints.length - 1][0]},${baseY} L ${visitorsPoints[0][0]},${baseY} Z`;
  }, [visitorsLinePath, visitorsPoints, plotHeight]);

  // Handle Chart Hover Scrubber
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !chartData.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaleX = svgWidth / rect.width;
    const currentSvgX = clientX * scaleX;

    const clampedX = Math.max(padLeft, Math.min(padLeft + plotWidth, currentSvgX));
    const ratio = (clampedX - padLeft) / plotWidth;
    const idx = Math.round(ratio * (chartData.length - 1));
    setHoverIndex(idx);
  };

  const activePoint = hoverIndex !== null && chartData[hoverIndex] ? chartData[hoverIndex] : null;

  // Max for Top Content bars
  const maxPageViews = stats?.topPages?.[0]?.views || 1;
  const maxAnimeViews = stats?.topAnime?.[0]?.views || 1;

  // Total Dayparts for distribution percentages
  const totalDaypartViews = useMemo(() => {
    if (!stats?.dayParts) return 1;
    const dp = stats.dayParts;
    return Math.max(dp.morning + dp.afternoon + dp.evening + dp.night, 1);
  }, [stats?.dayParts]);

  return (
    <div className="flex flex-col gap-6 text-on-surface">
      
      {/* Top Cyber Command Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container border border-outline-variant/30 p-3 clip-corner shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("telemetry")}
            className={`px-4 py-2 font-label-caps text-xs font-bold uppercase tracking-wider clip-chip transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "telemetry"
                ? "bg-cyber-cyan text-void-black shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                : "text-on-surface-variant hover:text-white hover:bg-surface-container-high"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Telemetry & Trends</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("broadcasts")}
            className={`px-4 py-2 font-label-caps text-xs font-bold uppercase tracking-wider clip-chip transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "broadcasts"
                ? "bg-neon-crimson text-void-black shadow-[0_0_15px_rgba(255,0,60,0.4)]"
                : "text-on-surface-variant hover:text-white hover:bg-surface-container-high"
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Broadcast Center</span>
          </button>
        </div>

        {/* Action Controls for Telemetry */}
        {activeTab === "telemetry" && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Range Selector */}
            <div className="flex bg-surface-container-high clip-chip p-0.5 border border-outline-variant/30">
              {(["24h", "7d", "30d", "90d"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 font-label-caps text-[11px] uppercase transition-all clip-chip cursor-pointer ${
                    range === r
                      ? "bg-cyber-cyan text-void-black font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!stats?.dailyViews?.length}
              title="Export CSV Telemetry"
              className="px-3 py-1.5 bg-surface-container-high hover:bg-white hover:text-void-black text-on-surface font-label-caps text-[11px] clip-chip border border-outline-variant/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: TELEMETRY & TRENDS (Single-Page Optimized View)   */}
      {/* ======================================================== */}
      {activeTab === "telemetry" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          
          {/* Row 1: KPI HUD Cards with Period-over-Period Deltas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Page Views */}
            <div className="bg-surface-container border border-outline-variant/30 p-4 clip-corner relative overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between text-cyber-cyan mb-1">
                <span className="font-label-caps text-xs uppercase tracking-widest text-on-surface-variant">Page Views</span>
                <Eye className="w-4 h-4" />
              </div>
              <div className="font-headline-xl text-3xl font-bold text-white tracking-tight drop-shadow-[0_0_10px_rgba(0,240,255,0.3)]">
                {stats ? stats.totalPageViews.toLocaleString() : "..."}
              </div>
              <div className="flex items-center gap-1.5 mt-2 font-label-caps text-[11px]">
                {stats && stats.viewsDeltaPct >= 0 ? (
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />
                    +{stats.viewsDeltaPct}%
                  </span>
                ) : (
                  <span className="text-neon-crimson flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" />
                    {stats?.viewsDeltaPct}%
                  </span>
                )}
                <span className="text-on-surface-variant text-xs">vs prior {range}</span>
              </div>
            </div>

            {/* Unique Visitors */}
            <div className="bg-surface-container border border-outline-variant/30 p-4 clip-corner relative overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between text-data-purple mb-1">
                <span className="font-label-caps text-xs uppercase tracking-widest text-on-surface-variant">Unique Visitors</span>
                <Users className="w-4 h-4" />
              </div>
              <div className="font-headline-xl text-3xl font-bold text-data-purple tracking-tight drop-shadow-[0_0_10px_rgba(189,0,255,0.3)]">
                {stats ? stats.uniqueVisitors.toLocaleString() : "..."}
              </div>
              <div className="flex items-center gap-1.5 mt-2 font-label-caps text-[11px]">
                {stats && stats.visitorsDeltaPct >= 0 ? (
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />
                    +{stats.visitorsDeltaPct}%
                  </span>
                ) : (
                  <span className="text-neon-crimson flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" />
                    {stats?.visitorsDeltaPct}%
                  </span>
                )}
                <span className="text-on-surface-variant text-xs">vs prior {range}</span>
              </div>
            </div>

            {/* Engagement Depth (Views / Visitor) */}
            <div className="bg-surface-container border border-outline-variant/30 p-4 clip-corner relative overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between text-cyber-cyan mb-1">
                <span className="font-label-caps text-xs uppercase tracking-widest text-on-surface-variant">Engagement Depth</span>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="font-headline-xl text-3xl font-bold text-white tracking-tight">
                {stats ? `${stats.avgViewsPerVisitor}x` : "..."}
              </div>
              <div className="mt-2 font-label-caps text-xs text-on-surface-variant truncate">
                Average views per active visitor
              </div>
            </div>

            {/* Peak Surge */}
            <div className="bg-surface-container border border-outline-variant/30 p-4 clip-corner relative overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between text-neon-crimson mb-1">
                <span className="font-label-caps text-xs uppercase tracking-widest text-on-surface-variant">Peak Traffic Spike</span>
                <Flame className="w-4 h-4" />
              </div>
              <div className="font-headline-xl text-3xl font-bold text-neon-crimson tracking-tight drop-shadow-[0_0_10px_rgba(255,0,60,0.3)]">
                {stats?.peakViews ? stats.peakViews.toLocaleString() : "0"}
              </div>
              <div className="mt-2 font-label-caps text-xs text-on-surface-variant truncate">
                Recorded on {stats?.peakDate ? stats.peakDate : "N/A"}
              </div>
            </div>
          </div>

          {/* Row 2: Interactive Cyber Precision Chart */}
          <div className="bg-surface-container border border-outline-variant/30 p-5 clip-corner shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative">
            
            {/* Chart Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-4">
                <h3 className="font-headline-md text-sm uppercase text-white tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyber-cyan" />
                  <span>Traffic Curve</span>
                </h3>

                {/* Metric Mode Selectors */}
                <div className="flex items-center gap-1 bg-void-black/60 p-1 clip-chip border border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => setMetricMode("all")}
                    className={`px-2.5 py-0.5 font-label-caps text-xs clip-chip transition-all cursor-pointer ${
                      metricMode === "all" ? "bg-white text-void-black font-bold" : "text-on-surface-variant hover:text-white"
                    }`}
                  >
                    Combined
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricMode("views")}
                    className={`px-2.5 py-0.5 font-label-caps text-xs clip-chip transition-all cursor-pointer flex items-center gap-1 ${
                      metricMode === "views" ? "bg-cyber-cyan text-void-black font-bold" : "text-cyber-cyan hover:bg-cyber-cyan/10"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan inline-block" />
                    Views
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricMode("visitors")}
                    className={`px-2.5 py-0.5 font-label-caps text-xs clip-chip transition-all cursor-pointer flex items-center gap-1 ${
                      metricMode === "visitors" ? "bg-data-purple text-void-black font-bold" : "text-data-purple hover:bg-data-purple/10"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-data-purple inline-block" />
                    Visitors
                  </button>
                </div>
              </div>

              {/* Chart Style Switch (Area vs Bar) */}
              <div className="flex items-center gap-1 bg-void-black/60 p-1 clip-chip border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setChartType("area")}
                  className={`p-1.5 clip-chip transition-all cursor-pointer ${
                    chartType === "area" ? "bg-cyber-cyan text-void-black shadow-[0_0_8px_#00F0FF]" : "text-on-surface-variant hover:text-white"
                  }`}
                  title="Area Line Curve"
                  aria-label="Area curve chart"
                >
                  <LineChart className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setChartType("bar")}
                  className={`p-1.5 clip-chip transition-all cursor-pointer ${
                    chartType === "bar" ? "bg-cyber-cyan text-void-black shadow-[0_0_8px_#00F0FF]" : "text-on-surface-variant hover:text-white"
                  }`}
                  title="Histogram Bars"
                  aria-label="Histogram bar chart"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Chart Canvas Area */}
            {statsError && stats && (
              <p role="status" className="mb-3 text-xs font-label-caps text-on-surface-variant">
                Analytics refresh failed; showing the last loaded data.
              </p>
            )}
            {statsLoading ? (
              <div className="h-64 flex items-center justify-center animate-pulse">
                <span className="font-label-caps text-xs text-cyber-cyan">CALCULATING TELEMETRY CURVES...</span>
              </div>
            ) : statsError && !stats ? (
              <div role="alert" className="h-64 flex flex-col items-center justify-center gap-3 text-center">
                <span className="font-label-caps text-xs text-on-surface-variant">Analytics could not be loaded.</span>
                <button
                  type="button"
                  onClick={() => void refetchStats()}
                  className="inline-flex min-h-11 items-center gap-2 px-4 font-label-caps text-xs text-cyber-cyan hover:text-white transition-colors"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  RETRY ANALYTICS
                </button>
              </div>
            ) : !chartData.length ? (
              <div className="h-64 flex items-center justify-center text-on-surface-variant font-label-caps text-xs">
                No telemetry recorded in this range.
              </div>
            ) : (
              <div className="relative w-full h-64 bg-void-black border border-outline-variant/20 clip-corner overflow-hidden select-none">
                {/* Oscilloscope Grid Background */}
                <div className="absolute inset-0 pointer-events-none opacity-25 bg-[linear-gradient(rgba(0,240,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.08)_1px,transparent_1px)] bg-size-[32px_32px]" />

                {/* AREA / LINE SVG RENDERER */}
                {chartType === "area" && (
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-full cursor-crosshair relative z-10"
                    preserveAspectRatio="none"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoverIndex(null)}
                  >
                    <defs>
                      <linearGradient id="cyberCyanGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.45" />
                        <stop offset="85%" stopColor="#00F0FF" stopOpacity="0.02" />
                        <stop offset="100%" stopColor="#00F0FF" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C084FC" stopOpacity="0.35" />
                        <stop offset="85%" stopColor="#C084FC" stopOpacity="0.02" />
                        <stop offset="100%" stopColor="#C084FC" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Reference Grid Lines */}
                    {[0.25, 0.5, 0.75].map((pct) => {
                      const y = padTop + plotHeight * (1 - pct);
                      return (
                        <line
                          key={pct}
                          x1={padLeft}
                          x2={padLeft + plotWidth}
                          y1={y}
                          y2={y}
                          stroke="rgba(255, 255, 255, 0.07)"
                          strokeDasharray="4 4"
                        />
                      );
                    })}

                    {/* Views Area & Stroke */}
                    {(metricMode === "all" || metricMode === "views") && (
                      <>
                        <path d={viewsAreaPath} fill="url(#cyberCyanGrad)" />
                        <path
                          d={viewsLinePath}
                          fill="none"
                          stroke="#00F0FF"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          className="drop-shadow-[0_0_8px_#00F0FF]"
                        />
                      </>
                    )}

                    {/* Visitors Area & Stroke */}
                    {(metricMode === "all" || metricMode === "visitors") && (
                      <>
                        <path d={visitorsAreaPath} fill="url(#purpleGrad)" />
                        <path
                          d={visitorsLinePath}
                          fill="none"
                          stroke="#C084FC"
                          strokeWidth="2"
                          strokeDasharray={metricMode === "all" ? "6 3" : undefined}
                          strokeLinecap="round"
                          className="drop-shadow-[0_0_8px_#C084FC]"
                        />
                      </>
                    )}

                    {/* Laser Crosshair Scrubber */}
                    {activePoint && hoverIndex !== null && (
                      <g>
                        <line
                          x1={viewsPoints[hoverIndex]?.[0] || 0}
                          x2={viewsPoints[hoverIndex]?.[0] || 0}
                          y1={padTop}
                          y2={padTop + plotHeight}
                          stroke="#00F0FF"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                        {(metricMode === "all" || metricMode === "views") && (
                          <circle
                            cx={viewsPoints[hoverIndex]?.[0] || 0}
                            cy={viewsPoints[hoverIndex]?.[1] || 0}
                            r="4.5"
                            fill="#FFFFFF"
                            stroke="#00F0FF"
                            strokeWidth="2.5"
                            className="drop-shadow-[0_0_8px_#00F0FF]"
                          />
                        )}
                        {(metricMode === "all" || metricMode === "visitors") && (
                          <circle
                            cx={visitorsPoints[hoverIndex]?.[0] || 0}
                            cy={visitorsPoints[hoverIndex]?.[1] || 0}
                            r="3.5"
                            fill="#FFFFFF"
                            stroke="#C084FC"
                            strokeWidth="2"
                            className="drop-shadow-[0_0_8px_#C084FC]"
                          />
                        )}
                      </g>
                    )}
                  </svg>
                )}

                {/* BAR HISTOGRAM RENDERER */}
                {chartType === "bar" && (
                  <div className="w-full h-full flex items-end gap-1 px-4 pb-3 pt-6 relative z-10">
                    {chartData.map((day, i) => {
                      const vPct = maxMetricVal > 0 ? (day.views / maxMetricVal) * 100 : 0;
                      const uPct = maxMetricVal > 0 ? (day.visitors / maxMetricVal) * 100 : 0;
                      const isHovered = hoverIndex === i;

                      return (
                        <div
                          key={i}
                          onMouseEnter={() => setHoverIndex(i)}
                          onMouseLeave={() => setHoverIndex(null)}
                          className="flex-1 h-full flex items-end justify-center group relative cursor-pointer"
                        >
                          <div
                            className={`w-full transition-all relative clip-chip ${
                              isHovered ? "bg-cyber-cyan shadow-[0_0_15px_#00F0FF]" : "bg-cyber-cyan/40 hover:bg-cyber-cyan/70"
                            }`}
                            style={{
                              height: `${Math.max(metricMode === "visitors" ? uPct : vPct, 3)}%`,
                            }}
                          >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-white shadow-[0_0_6px_#FFF]" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Floating Precision HUD Tooltip */}
                {activePoint && (
                  <div className="absolute top-3 right-3 pointer-events-none z-30 animate-in fade-in duration-100">
                    <div className="bg-void-black/90 border border-cyber-cyan px-3 py-2 text-xs font-label-caps shadow-[0_0_20px_rgba(0,240,255,0.3)] clip-chip backdrop-blur-md">
                      <div className="text-white font-bold flex items-center justify-between gap-4">
                        <span>{activePoint.date}</span>
                        <span className="text-xs text-cyber-cyan/80">TELEMETRY POINT</span>
                      </div>
                      <div className="h-px w-full bg-cyber-cyan/20 my-1.5" />
                      <div className="flex items-center gap-4 text-cyber-cyan">
                        <span>Views: <strong className="text-white text-sm">{activePoint.views.toLocaleString()}</strong></span>
                        <span className="text-data-purple">Visitors: <strong className="text-white text-sm">{activePoint.visitors.toLocaleString()}</strong></span>
                        <span className="text-on-surface-variant text-xs">
                          Ratio: {activePoint.visitors > 0 ? (activePoint.views / activePoint.visitors).toFixed(1) : 1}x
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Row 3: Compact 3-Column Bento (Content & Retention Intelligence) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Col 1: Top Anime */}
            <div className="bg-surface-container border border-outline-variant/30 p-4 clip-corner shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-outline-variant/20 pb-2">
                  <h4 className="font-headline-md text-xs uppercase text-neon-crimson tracking-wider flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Top Anime</span>
                  </h4>
                  <span className="text-xs font-label-caps text-cyber-cyan/80">VIEWS SHARE</span>
                </div>
                <div className="flex flex-col gap-2">
                  {stats?.topAnime.slice(0, 5).map((anime, idx) => {
                    const pct = maxAnimeViews > 0 ? Math.round((anime.views / maxAnimeViews) * 100) : 0;
                    return (
                      <div key={idx} className="flex flex-col gap-0.5 group">
                        <div className="flex items-center justify-between text-xs font-label-caps">
                          <Link
                            href={anime.animeId ? `/anime/${anime.animeId}` : "#"}
                            className="text-on-surface hover:text-neon-crimson truncate max-w-[70%] transition-colors flex items-center gap-1"
                            title={anime.title}
                          >
                            <span className="text-outline-variant text-xs">{(idx + 1).toString().padStart(2, "0")}</span>
                            <span className="truncate">{anime.title}</span>
                          </Link>
                          <span className="text-neon-crimson font-bold text-[11px]">{anime.views.toLocaleString()}</span>
                        </div>
                        <div className="h-1 bg-surface-container-high w-full overflow-hidden clip-chip">
                          <div
                            className="h-full bg-neon-crimson shadow-[0_0_6px_#FF003C] transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Col 2: Top Pages */}
            <div className="bg-surface-container border border-outline-variant/30 p-4 clip-corner shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-outline-variant/20 pb-2">
                  <h4 className="font-headline-md text-xs uppercase text-cyber-cyan tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Top Destinations</span>
                  </h4>
                  <span className="text-xs font-label-caps text-cyber-cyan/80">PAGE REACH</span>
                </div>
                <div className="flex flex-col gap-2">
                  {stats?.topPages.slice(0, 5).map((page, idx) => {
                    const pct = maxPageViews > 0 ? Math.round((page.views / maxPageViews) * 100) : 0;
                    return (
                      <div key={idx} className="flex flex-col gap-0.5 group">
                        <div className="flex items-center justify-between text-xs font-label-caps">
                          <Link
                            href={page.path.startsWith("/") ? page.path : `/${page.path}`}
                            className="text-on-surface hover:text-cyber-cyan truncate max-w-[70%] transition-colors flex items-center gap-1 font-mono text-[11px]"
                            title={page.path}
                          >
                            <span className="text-outline-variant text-xs">{(idx + 1).toString().padStart(2, "0")}</span>
                            <span className="truncate">{page.path}</span>
                          </Link>
                          <span className="text-cyber-cyan font-bold text-[11px]">{page.views.toLocaleString()}</span>
                        </div>
                        <div className="h-1 bg-surface-container-high w-full overflow-hidden clip-chip">
                          <div
                            className="h-full bg-cyber-cyan shadow-[0_0_6px_#00F0FF] transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Col 3: Daypart Traffic Distribution & Platform Health */}
            <div className="bg-surface-container border border-outline-variant/30 p-4 clip-corner shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-outline-variant/20 pb-2">
                  <h4 className="font-headline-md text-xs uppercase text-data-purple tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Daypart Traffic Density</span>
                  </h4>
                  <span className="text-xs font-label-caps text-cyber-cyan/80">HOURLY DISTRIBUTION</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-label-caps">
                  {/* Evening */}
                  <div className="bg-void-black/50 p-2 border border-outline-variant/20 clip-chip">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-on-surface-variant flex items-center gap-1"><Sunset className="w-3 h-3 text-amber-400" /> Evening</span>
                      <span className="text-white font-bold">{Math.round(((stats?.dayParts?.evening || 0) / totalDaypartViews) * 100)}%</span>
                    </div>
                    <div className="h-1 bg-surface-container-high w-full clip-chip overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${((stats?.dayParts?.evening || 0) / totalDaypartViews) * 100}%` }} />
                    </div>
                  </div>

                  {/* Night */}
                  <div className="bg-void-black/50 p-2 border border-outline-variant/20 clip-chip">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-on-surface-variant flex items-center gap-1"><Moon className="w-3 h-3 text-data-purple" /> Late Night</span>
                      <span className="text-white font-bold">{Math.round(((stats?.dayParts?.night || 0) / totalDaypartViews) * 100)}%</span>
                    </div>
                    <div className="h-1 bg-surface-container-high w-full clip-chip overflow-hidden">
                      <div className="h-full bg-data-purple" style={{ width: `${((stats?.dayParts?.night || 0) / totalDaypartViews) * 100}%` }} />
                    </div>
                  </div>

                  {/* Afternoon */}
                  <div className="bg-void-black/50 p-2 border border-outline-variant/20 clip-chip">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-on-surface-variant flex items-center gap-1"><Sun className="w-3 h-3 text-cyber-cyan" /> Afternoon</span>
                      <span className="text-white font-bold">{Math.round(((stats?.dayParts?.afternoon || 0) / totalDaypartViews) * 100)}%</span>
                    </div>
                    <div className="h-1 bg-surface-container-high w-full clip-chip overflow-hidden">
                      <div className="h-full bg-cyber-cyan" style={{ width: `${((stats?.dayParts?.afternoon || 0) / totalDaypartViews) * 100}%` }} />
                    </div>
                  </div>

                  {/* Morning */}
                  <div className="bg-void-black/50 p-2 border border-outline-variant/20 clip-chip">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-on-surface-variant flex items-center gap-1"><Coffee className="w-3 h-3 text-emerald-400" /> Morning</span>
                      <span className="text-white font-bold">{Math.round(((stats?.dayParts?.morning || 0) / totalDaypartViews) * 100)}%</span>
                    </div>
                    <div className="h-1 bg-surface-container-high w-full clip-chip overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${((stats?.dayParts?.morning || 0) / totalDaypartViews) * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* All-time platform counters */}
                <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px] font-label-caps text-on-surface-variant">
                  <span>Registered Users: <strong className="text-white">{stats?.totalUsers || 0}</strong></span>
                  <span>Comments: <strong className="text-white">{stats?.totalComments || 0}</strong></span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: BROADCAST STATION & SYSTEM LOGS                  */}
      {/* ======================================================== */}
      {activeTab === "broadcasts" && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          
          {/* Send Broadcast Form */}
          <div className="bg-surface-container border border-outline-variant/30 p-6 clip-corner shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3 mb-6 border-b border-outline-variant/20 pb-4">
              <Megaphone className="w-6 h-6 text-neon-crimson" />
              <h2 className="font-headline-lg text-xl uppercase tracking-wider text-on-surface drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">System Override</h2>
            </div>
            
            <form onSubmit={handleSendBroadcast} className="flex flex-col gap-4">
              {broadcastError && (
                <div className="bg-neon-crimson/10 border border-neon-crimson text-neon-crimson p-3 flex gap-2 items-center font-label-caps text-xs">
                  <AlertCircle className="w-4 h-4" />
                  {broadcastError}
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <label htmlFor="broadcastTitle" className="font-label-caps text-xs text-cyber-cyan uppercase before:content-['>_'] before:text-neon-crimson before:mr-2">Title <span className="text-neon-crimson">*</span></label>
                <input 
                  id="broadcastTitle"
                  type="text" 
                  value={broadcastForm.title}
                  onChange={e => setBroadcastForm({...broadcastForm, title: e.target.value})}
                  required
                  className="bg-void-black border border-outline-variant/30 p-3 text-cyber-cyan font-label-caps text-sm focus:outline-none focus:border-neon-crimson focus:shadow-[0_0_15px_rgba(255,0,60,0.2)] transition-all clip-chip"
                  placeholder="SYSTEM.UPDATE.V2"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label htmlFor="broadcastMessage" className="font-label-caps text-xs text-cyber-cyan uppercase before:content-['>_'] before:text-neon-crimson before:mr-2">Message <span className="text-neon-crimson">*</span></label>
                <textarea 
                  id="broadcastMessage"
                  value={broadcastForm.message}
                  onChange={e => setBroadcastForm({...broadcastForm, message: e.target.value})}
                  required
                  rows={4}
                  className="bg-void-black border border-outline-variant/30 p-3 text-cyber-cyan font-label-caps text-sm focus:outline-none focus:border-neon-crimson focus:shadow-[0_0_15px_rgba(255,0,60,0.2)] transition-all clip-chip resize-none"
                  placeholder="INITIALIZING_NEW_FEATURES..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="broadcastLinkUrl" className="font-label-caps text-xs text-cyber-cyan uppercase before:content-['>_'] before:text-neon-crimson before:mr-2">Link_URL</label>
                  <input 
                    id="broadcastLinkUrl"
                    type="text" 
                    value={broadcastForm.linkUrl}
                    onChange={e => setBroadcastForm({...broadcastForm, linkUrl: e.target.value})}
                    className="bg-void-black border border-outline-variant/30 p-3 text-cyber-cyan font-label-caps text-sm focus:outline-none focus:border-neon-crimson focus:shadow-[0_0_15px_rgba(255,0,60,0.2)] transition-all clip-chip"
                    placeholder="/watch/123"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="broadcastLinkLabel" className="font-label-caps text-xs text-cyber-cyan uppercase before:content-['>_'] before:text-neon-crimson before:mr-2">Link_Label</label>
                  <input 
                    id="broadcastLinkLabel"
                    type="text" 
                    value={broadcastForm.linkLabel}
                    onChange={e => setBroadcastForm({...broadcastForm, linkLabel: e.target.value})}
                    className="bg-void-black border border-outline-variant/30 p-3 text-cyber-cyan font-label-caps text-sm focus:outline-none focus:border-neon-crimson focus:shadow-[0_0_15px_rgba(255,0,60,0.2)] transition-all clip-chip"
                    placeholder="EXECUTE"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSending || !broadcastForm.title || !broadcastForm.message}
                className="mt-4 w-full border-2 border-neon-crimson bg-neon-crimson/10 text-neon-crimson font-label-caps text-sm uppercase tracking-widest p-4 hover:bg-neon-crimson hover:text-void-black hover:shadow-[0_0_20px_rgba(255,0,60,0.6)] transition-all clip-corner flex items-center justify-center gap-3 group disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {isSending ? (
                  <span className="animate-pulse flex items-center gap-2">
                    <span className="w-2 h-4 bg-current animate-pulse"></span> EXECUTING...
                  </span>
                ) : (
                  <>
                    <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    [ EXECUTE_BROADCAST ]
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Broadcast History / System Log */}
          <div className="bg-void-black border border-outline-variant/30 p-6 clip-corner shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col relative overflow-hidden group">
            {/* Scanline overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-50 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,240,255,0.05)_2px,rgba(0,240,255,0.05)_4px)] z-0" />
            
            <div className="flex items-center gap-3 mb-6 border-b border-cyber-cyan/30 pb-4 relative z-10">
              <Clock className="w-6 h-6 text-cyber-cyan" />
              <h2 className="font-headline-lg text-xl uppercase tracking-wider text-cyber-cyan drop-shadow-[0_0_10px_rgba(0,240,255,0.2)]">System Log</h2>
            </div>

            <div className="flex-1 overflow-y-auto max-h-115 pr-2 flex flex-col gap-2 relative z-10">
              {broadcastsLoading ? (
                <div className="animate-pulse flex flex-col gap-2">
                  {[1,2,3].map(i => <div key={i} className="h-12 bg-cyber-cyan/10 border-l-2 border-cyber-cyan/30 w-full" />)}
                </div>
              ) : broadcastsError && !broadcastsData ? (
                <div role="alert" className="flex flex-col items-start gap-3 py-4">
                  <p className="font-label-caps text-xs text-on-surface-variant">System log could not be loaded.</p>
                  <button
                    type="button"
                    onClick={() => void refetchBroadcasts()}
                    className="inline-flex min-h-11 items-center gap-2 font-label-caps text-xs text-cyber-cyan hover:text-white transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    RETRY LOG
                  </button>
                </div>
              ) : broadcastsData?.broadcasts.length === 0 ? (
                <p className="text-cyber-cyan/50 font-label-caps text-xs">No entries in system log.</p>
              ) : (
                <>
                  {broadcastsError && (
                    <p role="status" className="text-xs font-label-caps text-on-surface-variant">
                      System log refresh failed; showing the last loaded entries.
                    </p>
                  )}
                  {broadcastsData?.broadcasts.map(b => (
                    <div key={b.id} className="p-3 border-l-2 border-cyber-cyan/50 hover:border-cyber-cyan hover:bg-cyber-cyan/5 transition-all group/log bg-surface-container/30">
                      <div className="flex justify-between items-start gap-4 mb-1">
                        <span className="font-label-caps text-xs text-cyber-cyan group-hover/log:text-white transition-colors truncate">
                          <span className="text-cyber-cyan/50 mr-2">[{b.id.slice(0, 6).toUpperCase()}]</span>
                          {b.title}
                        </span>
                        <span className="font-label-caps text-xs text-cyber-cyan/70 shrink-0">{timeAgo(b.createdAt)}</span>
                      </div>
                      <p className="font-label-caps text-[11px] text-on-surface-variant/80 line-clamp-2 pl-1">{b.message}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Confirmation Modal for Broadcast */}
      <ConfirmModal
        isOpen={showBroadcastConfirm}
        onClose={() => setShowBroadcastConfirm(false)}
        onConfirm={confirmSendBroadcast}
        title="Send Global Broadcast?"
        description={`Are you sure you want to broadcast "${broadcastForm.title}" to all users? This will display as an announcement in their notification feeds.`}
        confirmText="SEND BROADCAST"
        variant="primary"
        isLoading={isSending}
      />
    </div>
  );
}

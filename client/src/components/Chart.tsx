import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
// Tree-shaken ECharts — register only what we use (much lighter than `echarts` full bundle)
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  RadarChart,
  FunnelChart,
  GaugeChart,
  TreemapChart,
} from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
  MarkAreaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { LabelLayout } from 'echarts/features';
import { useSettings } from '@/providers/SettingsProvider';
import { exportChart, ExportOptions } from '@/utils/export-utils';
import { lenientParse } from '@/lib/lenientJson';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  RadarChart,
  FunnelChart,
  GaugeChart,
  TreemapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
  MarkAreaComponent,
  CanvasRenderer,
  LabelLayout,
]);

// Premium vivid palette — applied as the default when the LLM config doesn't set colors
const PREMIUM_PALETTE = [
  '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#fbbf24',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#d946ef', '#eab308',
];

const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const verticalGradient = (color: string, from = 0.55, to = 0.06) =>
  new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: hexToRgba(color, from) },
    { offset: 1, color: hexToRgba(color, to) },
  ]);

// ---------------------------------------------------------------------------
// LLM config hardening. Models emit plausible-looking but ECharts-hostile
// options (objects where an axis index belongs, chart types like "barChart",
// single-element pair data). Unknown structures crash setOption internals
// ("Cannot read properties of undefined (reading 'get')") and the writer sees
// a "Chart Error" card. Pass the option through a whitelist so any parseable
// config produces a chart.
// ---------------------------------------------------------------------------
const CHART_TYPE_ALIASES: Record<string, string> = {
  bar: 'bar', barchart: 'bar', columnchart: 'bar',
  line: 'line', linechart: 'line', area: 'line', areachart: 'line',
  pie: 'pie', piechart: 'pie', doughnut: 'pie', donut: 'pie',
  scatter: 'scatter', scatterchart: 'scatter', bubblechart: 'scatter',
  radar: 'radar', radarchart: 'radar',
  funnel: 'funnel', funnelchart: 'funnel',
  gauge: 'gauge', gaugechart: 'gauge',
  treemap: 'treemap', heatmap: 'heatmap',
};

const SERIES_ALLOWED_KEYS = new Set([
  'name', 'type', 'data', 'itemStyle', 'lineStyle', 'areaStyle', 'label',
  'labelLine', 'emphasis', 'barWidth', 'barGap', 'stack', 'symbol',
  'symbolSize', 'smooth', 'radius', 'center', 'roseType', 'startAngle',
  'avoidLabelOverlap', 'showBackground', 'backgroundStyle', 'markLine',
  'markPoint', 'markArea', 'left', 'right', 'top', 'bottom', 'width', 'height',
]);

const OPTION_ALLOWED_KEYS = [
  'title', 'legend', 'tooltip', 'grid', 'xAxis', 'yAxis', 'series', 'color',
  'backgroundColor', 'animation', 'animationDuration', 'animationEasing',
  'animationDelayUpdate', 'radar', 'polar', 'angleAxis', 'radiusAxis',
  'visualMap', 'dataZoom', 'graphic', 'textStyle',
];

function normalizeChartType(raw: any): string {
  const key = String(raw ?? 'bar').toLowerCase().replace(/[^a-z]/g, '');
  return CHART_TYPE_ALIASES[key] || 'bar';
}

function repairSeriesData(data: any): any {
  if (!Array.isArray(data)) return [];
  return data
    .map((d) => (Array.isArray(d) && d.length === 1 ? d[0] : d))
    .filter((d) => d === null || typeof d === 'number' || typeof d === 'string' || (d && typeof d === 'object'));
}

function sanitizeSeries(series: any): any[] {
  if (!Array.isArray(series)) return [];
  return series.map((s) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      return { type: 'bar', data: [] };
    }
    const rawType = s.type ?? s.chartType ?? s.chart ?? 'bar';
    const type = normalizeChartType(rawType);
    const clean: any = { type };
    for (const key of Object.keys(s)) {
      if (SERIES_ALLOWED_KEYS.has(key)) clean[key] = s[key];
    }
    clean.data = repairSeriesData(clean.data);
    // An "area" chart is a line chart with a fill.
    if (type === 'line' && /area/i.test(String(rawType)) && !clean.areaStyle) {
      clean.areaStyle = {};
    }
    return clean;
  });
}

const AXIS_ALLOWED_KEYS = new Set([
  'type', 'data', 'name', 'nameTextStyle', 'min', 'max', 'scale', 'inverse',
  'axisLine', 'axisLabel', 'axisTick', 'splitLine', 'splitArea',
  'boundaryGap', 'position', 'offset', 'interval', 'rotate', 'formatter',
]);

function sanitizeAxis(axis: any, defaultType: string): any {
  // Absent or non-object axes are replaced with clean defaults — a malformed
  // xAxis paired with a missing yAxis crashes cartesian series init
  // ("Cannot read properties of undefined (reading 'get')") and poisons the
  // painter for the rest of the session.
  if (!axis || typeof axis !== 'object' || Array.isArray(axis)) {
    return { type: defaultType };
  }
  const clean: any = { type: typeof axis.type === 'string' ? axis.type : defaultType };
  for (const key of Object.keys(axis)) {
    if (AXIS_ALLOWED_KEYS.has(key)) clean[key] = axis[key];
  }
  if (clean.type === 'category' && !Array.isArray(clean.data)) {
    clean.data = [];
  }
  return clean;
}

function sanitizeChartOption(option: any): any {
  if (!option || typeof option !== 'object') return option;
  const out: any = {};
  for (const key of OPTION_ALLOWED_KEYS) {
    if (option[key] !== undefined) out[key] = option[key];
  }
  out.series = sanitizeSeries(option.series);

  const needsCartesian = out.series.some((s: any) => ['bar', 'line'].includes(s.type));
  if (needsCartesian) {
    out.xAxis = sanitizeAxis(out.xAxis, 'category');
    out.yAxis = sanitizeAxis(out.yAxis, 'value');
    // Numeric data on a category axis with no labels: synthesize indexes so
    // bars/lines land at distinct positions instead of stacking on one slot.
    if (out.xAxis.type === 'category' && (!Array.isArray(out.xAxis.data) || out.xAxis.data.length === 0)) {
      const maxLen = Math.max(1, ...out.series.map((s: any) => (Array.isArray(s.data) ? s.data.length : 0)));
      out.xAxis.data = Array.from({ length: maxLen }, (_, i) => String(i + 1));
    }
  } else {
    delete out.xAxis;
    delete out.yAxis;
  }

  // Legend booleans where numbers/percentages belong crash layout.
  if (out.legend && typeof out.legend === 'object') {
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      if (typeof out.legend[edge] === 'boolean') delete out.legend[edge];
    }
  }
  return out;
}

interface ChartProps {
  config: any;
  className?: string;
  style?: React.CSSProperties;
  autoHeight?: boolean;
  minHeight?: number;
  maxHeight?: number;
  aspectRatio?: number;
  exportQuality?: 'standard' | 'high' | 'ultra';
}

export interface ChartRef {
  exportChart: (options: ExportOptions) => Promise<string>;
  getChartInstance: () => echarts.ECharts | null;
  resize: () => void;
}

const Chart = forwardRef<ChartRef, ChartProps>(({
  config,
  className = '',
  style,
  autoHeight = true,
  minHeight = 400,
  maxHeight = 800,
  aspectRatio = 16 / 9,
  exportQuality = 'high',
}, ref) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const { settings } = useSettings();
  const [dynamicHeight, setDynamicHeight] = useState(500);

  // Expose chart methods via ref
  useImperativeHandle(ref, () => ({
    exportChart: async (options: ExportOptions) => {
      if (!chartInstance.current) {
        throw new Error('Chart instance not available');
      }
      return await exportChart(chartInstance.current, options);
    },
    getChartInstance: () => chartInstance.current,
    resize: () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    },
  }));

  useEffect(() => {
    if (!chartRef.current) return;

    const pixelRatio = exportQuality === 'ultra' ? 4 : exportQuality === 'high' ? 3 : (window.devicePixelRatio || 2);
    chartInstance.current = echarts.init(chartRef.current, null, {
      devicePixelRatio: pixelRatio,
      renderer: 'canvas',
      useDirtyRect: true,
      width: 'auto',
      height: 'auto',
    });

    // If the container had zero size at init time (hidden panel, pending
    // layout), ECharts silently renders nothing and never recovers on its
    // own. Watch the container and repaint whenever its size changes.
    const resizeObserver = new ResizeObserver(() => {
      try {
        chartInstance.current?.resize();
      } catch { /* instance disposed mid-callback */ }
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (!chartInstance.current) {
      console.log('❌ Chart instance not available');
      return;
    }

    if (!config) {
      console.log('❌ No chart config provided');
      return;
    }

    try {
      let chartConfig;

      // Enhanced config parsing with validation — LLM output is often
      // near-JSON (unquoted keys, trailing commas); use the lenient parser.
      if (typeof config === 'string') {
        let cleanConfig = config.trim();
        cleanConfig = cleanConfig.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
        const jsonMatch = cleanConfig.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanConfig = jsonMatch[0];
        }
        try {
          chartConfig = lenientParse(cleanConfig);
        } catch (parseError) {
          throw new Error(`Invalid JSON configuration: ${parseError}`);
        }
      } else {
        chartConfig = config;
      }

      if (!chartConfig || typeof chartConfig !== 'object') {
        throw new Error('Chart configuration must be an object');
      }

      // Dynamic height based on content
      const calculateDynamicHeight = () => {
        if (!autoHeight) return 500;
        const containerWidth = chartRef.current?.clientWidth || 800;
        const calculatedHeight = Math.max(
          minHeight,
          Math.min(maxHeight, containerWidth / aspectRatio)
        );
        const hasMultipleSeries = chartConfig.series?.length > 1;
        const hasLegend = chartConfig.legend;
        const complexityFactor = hasMultipleSeries || hasLegend ? 1.2 : 1;
        return Math.round(calculatedHeight * complexityFactor);
      };

      const newHeight = calculateDynamicHeight();
      setDynamicHeight(newHeight);

      // ---- Premium theme: apply vibrant defaults, let explicit LLM config win ----
      const colors: string[] = chartConfig.color || PREMIUM_PALETTE;

      const enhanceSeries = (series: any[] = [], baseIndex = 0): any[] =>
        series.map((s, i) => {
          const idx = (baseIndex + i) % colors.length;
          const color = colors[idx];
          const enhanced: any = { ...s };

          if (s.type === 'bar' && !s.itemStyle?.color) {
            enhanced.itemStyle = {
              ...s.itemStyle,
              color: verticalGradient(color, 0.85, 0.15),
              borderRadius: s.itemStyle?.borderRadius ?? [6, 6, 0, 0],
            };
          } else if (s.type === 'line') {
            enhanced.lineStyle = {
              width: 3,
              ...s.lineStyle,
              color: s.lineStyle?.color ?? color,
            };
            if (!s.areaStyle) {
              enhanced.areaStyle = { color: verticalGradient(color, 0.32, 0) };
            }
            enhanced.symbol = s.symbol ?? 'circle';
            enhanced.symbolSize = s.symbolSize ?? 7;
            if (!s.itemStyle) enhanced.itemStyle = { color };
          } else if (s.type === 'scatter') {
            enhanced.itemStyle = { ...s.itemStyle, color: s.itemStyle?.color ?? color, shadowBlur: 8, shadowColor: hexToRgba(color, 0.4) };
          } else if (['pie', 'funnel', 'sunburst', 'treemap', 'sankey', 'graph', 'radar'].includes(s.type)) {
            enhanced.emphasis = {
              ...s.emphasis,
              itemStyle: {
                shadowBlur: 12,
                shadowColor: 'rgba(0,0,0,0.25)',
                ...s.emphasis?.itemStyle,
              },
            };
          }

          // Multi-dataset support (e.g. nested pie via datasets)
          if (s.datasets) {
            enhanced.datasets = enhanceSeries(s.datasets, idx);
          }
          return enhanced;
        });

      const enhancedConfig = {
        ...chartConfig,
        color: colors,
        backgroundColor: chartConfig.backgroundColor ?? 'transparent',
        grid: {
          containLabel: true,
          top: Math.max(60, newHeight * 0.12),
          right: Math.max(60, newHeight * 0.1),
          bottom: Math.max(60, newHeight * 0.12),
          left: Math.max(80, newHeight * 0.12),
          ...chartConfig.grid,
        },
        animation: true,
        animationDuration: 800,
        animationEasing: 'cubicOut',
        animationDelayUpdate: 200,
        tooltip: {
          trigger: 'axis',
          backgroundColor: settings.theme === 'dark' ? 'rgba(24,24,32,0.96)' : 'rgba(255,255,255,0.96)',
          borderColor: settings.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          borderWidth: 1,
          borderRadius: 12,
          padding: [10, 14],
          extraCssText: 'box-shadow: 0 12px 32px rgba(0,0,0,0.18); backdrop-filter: blur(8px);',
          textStyle: {
            color: settings.theme === 'dark' ? '#f4f4f5' : '#27272a',
            fontSize: 13,
            fontWeight: '500',
          },
          ...chartConfig.tooltip,
        },
        legend: chartConfig.legend ? {
          ...chartConfig.legend,
          icon: chartConfig.legend.icon ?? 'roundRect',
          itemWidth: chartConfig.legend.itemWidth ?? 14,
          itemHeight: chartConfig.legend.itemHeight ?? 8,
          textStyle: {
            color: settings.theme === 'dark' ? '#a1a1aa' : '#71717a',
            fontSize: 12,
            fontWeight: '500',
            ...chartConfig.legend?.textStyle,
          },
        } : undefined,
        series: enhanceSeries(chartConfig.series),
        ...(chartConfig.title ? {
          title: {
            ...chartConfig.title,
            textStyle: {
              color: settings.theme === 'dark' ? '#fafafa' : '#18181b',
              fontWeight: '700',
              ...chartConfig.title?.textStyle,
            },
            subtextStyle: {
              color: settings.theme === 'dark' ? '#a1a1aa' : '#71717a',
              ...chartConfig.title?.subtextStyle,
            },
          },
        } : {}),
      };

      chartInstance.current.setOption(sanitizeChartOption(enhancedConfig), true);
      console.log('✅ Chart options set successfully');

      // Debounced resize handler
      let resizeTimeout: NodeJS.Timeout;
      const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (chartInstance.current && chartRef.current) {
            const newHeight = calculateDynamicHeight();
            setDynamicHeight(newHeight);
            chartInstance.current.resize();
          }
        }, 150);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(resizeTimeout);
      };
    } catch (error) {
      console.error('❌ Error rendering chart:', error);
      console.error('Config that caused error:', config);

      if (chartInstance.current) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        chartInstance.current.setOption({
          title: {
            text: 'Chart Error',
            left: 'center',
            top: 'middle',
            textStyle: { color: '#ff4444', fontSize: 18 },
          },
          graphic: {
            elements: [{
              type: 'text',
              left: 'center',
              top: '60%',
              style: {
                text: `Error: ${errorMessage}`,
                fill: '#888',
                fontSize: 14,
              },
            }],
          },
        });
      }
    }
  }, [config]);

  // Show loading state when no config
  if (!config) {
    return (
      <div
        className={`chart-container ${className} flex items-center justify-center`}
        style={{
          width: '100%',
          minHeight: `${minHeight}px`,
          height: `${dynamicHeight}px`,
          background: 'transparent',
          borderRadius: '12px',
          border: '2px dashed #ccc',
          ...style,
        }}
      >
        <div className="text-center text-gray-500">
          <div className="text-lg mb-2">📊</div>
          <div>Loading chart...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartRef}
      className={`chart-container ${className}`}
      style={{
        width: '100%',
        minHeight: `${minHeight}px`,
        height: `${dynamicHeight}px`,
        background: 'transparent',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'height 0.3s ease-in-out',
        ...style,
      }}
    />
  );
});

Chart.displayName = 'Chart';

export default Chart;

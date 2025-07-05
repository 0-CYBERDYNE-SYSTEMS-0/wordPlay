import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as echarts from 'echarts';
import { useSettings } from '@/providers/SettingsProvider';
import { exportChart, ExportOptions } from '@/utils/export-utils';

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
  aspectRatio = 16/9,
  exportQuality = 'high'
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
    }
  }));

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart with ultra-high-quality rendering options
    const pixelRatio = exportQuality === 'ultra' ? 4 : exportQuality === 'high' ? 3 : (window.devicePixelRatio || 2);
    chartInstance.current = echarts.init(chartRef.current, null, {
      devicePixelRatio: pixelRatio, // Ultra-high DPI support for exports
      renderer: 'canvas', // Use canvas for better performance and quality
      useDirtyRect: true, // Performance optimization
      width: 'auto',
      height: 'auto'
    });
    
    return () => {
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
      console.log('🔧 Chart config received:', typeof config);
      console.log('📝 Raw config:', config);
      
      let chartConfig;
      
      // Enhanced config parsing with validation
      if (typeof config === 'string') {
        // Clean the config string
        let cleanConfig = config.trim();
        
        // Remove any markdown code block markers
        cleanConfig = cleanConfig.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
        
        // Try to find JSON within the string
        const jsonMatch = cleanConfig.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanConfig = jsonMatch[0];
        }
        
        console.log('🧹 Cleaned config:', cleanConfig.substring(0, 300) + '...');
        
        try {
          chartConfig = JSON.parse(cleanConfig);
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError);
          console.error('Failed to parse:', cleanConfig);
          throw new Error(`Invalid JSON configuration: ${parseError}`);
        }
      } else {
        chartConfig = config;
      }
      
      // Validate chart configuration
      if (!chartConfig || typeof chartConfig !== 'object') {
        throw new Error('Chart configuration must be an object');
      }
      
      console.log('📊 Parsed chart config:', JSON.stringify(chartConfig, null, 2));
      
      // Calculate dynamic height based on content
      const calculateDynamicHeight = () => {
        if (!autoHeight) return 500;
        
        const containerWidth = chartRef.current?.clientWidth || 800;
        const calculatedHeight = Math.max(
          minHeight,
          Math.min(maxHeight, containerWidth / aspectRatio)
        );
        
        // Adjust based on data complexity
        const hasMultipleSeries = chartConfig.series?.length > 1;
        const hasLegend = chartConfig.legend;
        const complexityFactor = hasMultipleSeries || hasLegend ? 1.2 : 1;
        
        return Math.round(calculatedHeight * complexityFactor);
      };
      
      const newHeight = calculateDynamicHeight();
      setDynamicHeight(newHeight);
      
      // Enhanced chart configuration with dynamic sizing and premium styling
      const enhancedConfig = {
        ...chartConfig,
        // Ensure responsive grid with dynamic spacing
        grid: {
          containLabel: true,
          top: Math.max(60, newHeight * 0.12),
          right: Math.max(60, newHeight * 0.1),
          bottom: Math.max(60, newHeight * 0.12),
          left: Math.max(80, newHeight * 0.12),
          ...chartConfig.grid
        },
        // Ultra-smooth animations with spring physics
        animation: true,
        animationDuration: 1200,
        animationEasing: 'elasticOut',
        animationDelayUpdate: 300,
        // Premium tooltip with glass-morphism
        tooltip: {
          trigger: 'axis',
          backgroundColor: settings.theme === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: settings.theme === 'dark' ? '#444' : '#ccc',
          borderWidth: 1,
          borderRadius: 12,
          padding: [12, 16],
          textStyle: {
            color: settings.theme === 'dark' ? '#fff' : '#333',
            fontSize: 13,
            fontWeight: '500'
          },
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          ...chartConfig.tooltip
        },
        // Enhanced legend with better positioning
        legend: chartConfig.legend ? {
          ...chartConfig.legend,
          textStyle: {
            color: settings.theme === 'dark' ? '#ccc' : '#666',
            fontSize: 12,
            fontWeight: '500',
            ...chartConfig.legend?.textStyle
          }
        } : chartConfig.legend
      };
      
      // Set chart options
      chartInstance.current.setOption(enhancedConfig, true);
      console.log('✅ Chart options set successfully');
      
      // Enhanced resize handler with debouncing
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
      
      // Show error in chart container
      if (chartInstance.current) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        chartInstance.current.setOption({
          title: {
            text: 'Chart Error',
            left: 'center',
            top: 'middle',
            textStyle: {
              color: '#ff4444',
              fontSize: 18
            }
          },
          graphic: {
            elements: [{
              type: 'text',
              left: 'center',
              top: '60%',
              style: {
                text: `Error: ${errorMessage}`,
                fill: '#888',
                fontSize: 14
              }
            }]
          }
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
          ...style 
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
        ...style 
      }}
    />
  );
});

Chart.displayName = 'Chart';

export default Chart;
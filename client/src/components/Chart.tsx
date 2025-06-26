import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface ChartProps {
  config: any;
  className?: string;
  style?: React.CSSProperties;
}

export default function Chart({ config, className = '', style }: ChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    chartInstance.current = echarts.init(chartRef.current);
    
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (!chartInstance.current || !config) {
      console.log('❌ Chart effect early return:', { chartInstance: !!chartInstance.current, config: !!config });
      return;
    }

    try {
      console.log('🔧 Chart config received:', typeof config, config.substring ? config.substring(0, 200) + '...' : config);
      
      // Parse config if it's a string
      const chartConfig = typeof config === 'string' ? JSON.parse(config) : config;
      console.log('📊 Parsed chart config:', chartConfig);
      
      // Set chart options
      chartInstance.current.setOption(chartConfig, true);
      console.log('✅ Chart options set successfully');
      
      // Handle resize
      const handleResize = () => {
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    } catch (error) {
      console.error('❌ Error rendering chart:', error);
      console.error('Config that caused error:', config);
    }
  }, [config]);

  return (
    <div 
      ref={chartRef} 
      className={`chart-container ${className}`}
      style={{ 
        width: '100%', 
        height: '400px', 
        ...style 
      }}
    />
  );
}
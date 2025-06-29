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

    // Initialize chart with high-quality rendering options
    chartInstance.current = echarts.init(chartRef.current, null, {
      devicePixelRatio: window.devicePixelRatio || 2, // High DPI support
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
      
      // Enhanced chart configuration with defaults
      const enhancedConfig = {
        ...chartConfig,
        // Ensure responsive grid
        grid: {
          containLabel: true,
          top: 80,
          right: 80,
          bottom: 80,
          left: 100,
          ...chartConfig.grid
        },
        // Enhance animations
        animation: true,
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        // Enhance tooltip
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: '#ccc',
          borderWidth: 1,
          textStyle: {
            color: '#333'
          },
          ...chartConfig.tooltip
        }
      };
      
      // Set chart options
      chartInstance.current.setOption(enhancedConfig, true);
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
          minHeight: '500px',
          height: '500px',
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
        minHeight: '500px',
        height: '500px',
        background: 'transparent',
        borderRadius: '12px',
        overflow: 'hidden',
        ...style 
      }}
    />
  );
}
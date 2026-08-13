import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { ECharts } from 'echarts/core';

export interface ExportOptions {
  format: 'pdf' | 'png' | 'jpg' | 'svg';
  quality: 'standard' | 'high' | 'ultra';
  includeMetadata: boolean;
  backgroundColor?: string;
  scale?: number;
}

export interface DocumentExportOptions extends ExportOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter' | 'a3';
}

/**
 * Export a chart to various formats with high quality
 */
export async function exportChart(
  chartInstance: ECharts,
  options: ExportOptions
): Promise<string> {
  const { format, quality, backgroundColor = 'white' } = options;
  
  // Calculate optimal pixel ratio for export quality
  const pixelRatio = quality === 'ultra' ? 4 : quality === 'high' ? 3 : 2;
  
  try {
    if (format === 'svg') {
      // Export as SVG for vector graphics
      const svgString = chartInstance.renderToSVGString();
      return svgString;
    } else {
      // Export as bitmap (PNG/JPG)
      const canvas = chartInstance.getRenderedCanvas({
        pixelRatio,
        backgroundColor
      });
      
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const qualityValue = quality === 'ultra' ? 1.0 : quality === 'high' ? 0.95 : 0.85;
      
      return canvas.toDataURL(mimeType, qualityValue);
    }
  } catch (error) {
    console.error('Error exporting chart:', error);
    throw new Error('Failed to export chart');
  }
}

/**
 * Export an image element with enhanced quality
 */
export async function exportImage(
  imageElement: HTMLImageElement,
  options: ExportOptions
): Promise<string> {
  const { format, quality, backgroundColor = 'white' } = options;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Calculate optimal dimensions
  const scale = options.scale || (quality === 'ultra' ? 4 : quality === 'high' ? 3 : 2);
  canvas.width = imageElement.naturalWidth * scale;
  canvas.height = imageElement.naturalHeight * scale;
  
  // Set background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = quality === 'ultra' ? 'high' : 'medium';
  
  // Draw image
  ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
  
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const qualityValue = quality === 'ultra' ? 1.0 : quality === 'high' ? 0.95 : 0.85;
  
  return canvas.toDataURL(mimeType, qualityValue);
}

/**
 * Export entire document with charts and images to PDF
 */
export async function exportDocumentToPDF(
  documentElement: HTMLElement,
  options: DocumentExportOptions
): Promise<void> {
  const {
    title = 'Document',
    author = 'WordPlay',
    subject = 'Generated Document',
    keywords = [],
    orientation = 'portrait',
    pageSize = 'a4',
    quality = 'high',
    backgroundColor = 'white'
  } = options;
  
  try {
    // Create PDF document
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: pageSize
    });
    
    // Set document metadata
    pdf.setProperties({
      title,
      author,
      subject,
      keywords: keywords.join(', '),
      creator: 'WordPlay Document Generator'
    });
    
    // Configure html2canvas for high quality
    const canvas = await html2canvas(documentElement, {
      scale: quality === 'ultra' ? 4 : quality === 'high' ? 3 : 2,
      backgroundColor,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,
      removeContainer: true,
      foreignObjectRendering: true,
      // Enhanced settings for charts and images
      onclone: (clonedDoc) => {
        // Ensure all charts are rendered in the clone
        const charts = clonedDoc.querySelectorAll('.chart-container');
        charts.forEach((chart) => {
          const canvas = chart.querySelector('canvas');
          if (canvas) {
            // Ensure chart is fully rendered
            canvas.style.display = 'block';
            canvas.style.visibility = 'visible';
          }
        });
        
        // Ensure all images are loaded
        const images = clonedDoc.querySelectorAll('img');
        images.forEach((img) => {
          img.style.display = 'block';
          img.style.visibility = 'visible';
        });
      }
    });
    
    // Calculate PDF dimensions
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate scale to fit page
    const scale = Math.min(pageWidth / canvasWidth, pageHeight / canvasHeight);
    const scaledWidth = canvasWidth * scale;
    const scaledHeight = canvasHeight * scale;
    
    // Center the content on the page
    const x = (pageWidth - scaledWidth) / 2;
    const y = (pageHeight - scaledHeight) / 2;
    
    // Add image to PDF
    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
    
    // Save PDF
    pdf.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    
  } catch (error) {
    console.error('Error exporting document to PDF:', error);
    throw new Error('Failed to export document to PDF');
  }
}

/**
 * Export document element to high-quality image
 */
export async function exportDocumentToImage(
  documentElement: HTMLElement,
  options: ExportOptions
): Promise<string> {
  const { format, quality, backgroundColor = 'white' } = options;
  
  try {
    const canvas = await html2canvas(documentElement, {
      scale: quality === 'ultra' ? 4 : quality === 'high' ? 3 : 2,
      backgroundColor,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,
      removeContainer: true,
      foreignObjectRendering: true
    });
    
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const qualityValue = quality === 'ultra' ? 1.0 : quality === 'high' ? 0.95 : 0.85;
    
    return canvas.toDataURL(mimeType, qualityValue);
  } catch (error) {
    console.error('Error exporting document to image:', error);
    throw new Error('Failed to export document to image');
  }
}

/**
 * Print document with optimized chart and image rendering
 */
export async function printDocument(documentElement: HTMLElement): Promise<void> {
  // Create a print-optimized clone
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    throw new Error('Failed to open print window');
  }
  
  // Clone the document content
  const clonedContent = documentElement.cloneNode(true) as HTMLElement;
  
  // Apply print-specific styles
  const printStyles = `
    <style>
      @media print {
        body { 
          margin: 0; 
          padding: 20px; 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #000;
        }
        
        .chart-container {
          page-break-inside: avoid;
          margin: 20px 0;
          background: white !important;
        }
        
        .chart-container canvas {
          max-width: 100% !important;
          height: auto !important;
        }
        
        img {
          max-width: 100% !important;
          height: auto !important;
          page-break-inside: avoid;
          margin: 10px 0;
        }
        
        h1, h2, h3, h4, h5, h6 {
          page-break-after: avoid;
          margin-top: 20px;
          margin-bottom: 10px;
        }
        
        p {
          orphans: 3;
          widows: 3;
        }
        
        table {
          page-break-inside: auto;
        }
        
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        
        .no-print {
          display: none !important;
        }
      }
    </style>
  `;
  
  // Build print document
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Print Document</title>
        ${printStyles}
      </head>
      <body>
        ${clonedContent.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  
  printWindow.document.close();
}

/**
 * Get optimal export settings based on use case
 */
export function getOptimalExportSettings(
  useCase: 'web' | 'print' | 'presentation' | 'archive'
): ExportOptions {
  const settings: Record<string, ExportOptions> = {
    web: {
      format: 'png',
      quality: 'standard',
      includeMetadata: false,
      scale: 2
    },
    print: {
      format: 'pdf',
      quality: 'high',
      includeMetadata: true,
      backgroundColor: 'white',
      scale: 3
    },
    presentation: {
      format: 'png',
      quality: 'ultra',
      includeMetadata: true,
      backgroundColor: 'white',
      scale: 4
    },
    archive: {
      format: 'pdf',
      quality: 'ultra',
      includeMetadata: true,
      backgroundColor: 'white',
      scale: 4
    }
  };
  
  return settings[useCase];
}
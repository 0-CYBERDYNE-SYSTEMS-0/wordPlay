import type { ECharts } from 'echarts/core';
import * as echarts from 'echarts/core';

export interface ExportOptions {
  format: 'pdf' | 'png' | 'jpg' | 'svg';
  quality: 'standard' | 'high' | 'ultra';
  includeMetadata: boolean;
  backgroundColor?: string;
  scale?: number;
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

// ---------------------------------------------------------------------------
// Standalone HTML export — the "get it out into the wild" path.
//
// Captures the live preview DOM (the same renderer the writer is looking at)
// and makes it portable:
//   • every ECharts canvas is flattened to a high-res PNG <img>
//   • every /uploads/… image is inlined as a base64 data URL
// so the resulting single .html file renders identically on GitHub-less,
// server-less surfaces: email attachments, shared drives, a blog CMS, print.
// ---------------------------------------------------------------------------

async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function captureStandaloneHtml(title: string, container: HTMLElement): Promise<string> {
  const clone = container.cloneNode(true) as HTMLElement;

  // 1. Flatten live ECharts canvases to high-resolution PNG images.
  const sourceCharts = Array.from(container.querySelectorAll<HTMLElement>('.chart-container, [data-chart], ._echarts_instance_'));
  const cloneCharts = Array.from(clone.querySelectorAll<HTMLElement>('.chart-container, [data-chart], ._echarts_instance_'));
  for (let i = 0; i < cloneCharts.length; i++) {
    const srcEl = sourceCharts[i];
    const dstEl = cloneCharts[i];
    if (!srcEl || !dstEl) continue;
    try {
      const instance = echarts.getInstanceByDom(srcEl);
      if (!instance) continue;
      const canvas = instance.getRenderedCanvas({ pixelRatio: 3, backgroundColor: '#ffffff' });
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png', 1.0);
      img.alt = 'Chart';
      img.style.maxWidth = '100%';
      dstEl.replaceWith(img);
    } catch (err) {
      console.warn('Chart capture failed; keeping raw canvas fallback', err);
    }
  }
  // Any canvas not covered above (defensive) becomes a static PNG too.
  for (const canvas of Array.from(clone.querySelectorAll('canvas'))) {
    try {
      const img = document.createElement('img');
      img.src = (canvas as HTMLCanvasElement).toDataURL('image/png', 1.0);
      img.alt = 'Chart';
      img.style.maxWidth = '100%';
      canvas.replaceWith(img);
    } catch { /* tainted canvas — leave as-is */ }
  }

  // 2. Inline server-hosted images as data URLs so the file is self-contained.
  const imgs = Array.from(clone.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || '';
      if (src.startsWith('/uploads/') || src.startsWith('./uploads/')) {
        const dataUrl = await imageToDataUrl(src);
        if (dataUrl) img.setAttribute('src', dataUrl);
      }
    })
  );

  // 3. Strip interactive leftovers that make no sense outside the app.
  clone.querySelectorAll('button, .no-export, script').forEach((el) => el.remove());

  return buildStandaloneDocument(title, clone.innerHTML);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] || c));
}

function buildStandaloneDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #faf9f7;
    color: #1c1917;
    font-family: Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif;
    line-height: 1.75;
  }
  main {
    max-width: 760px;
    margin: 0 auto;
    padding: 48px 24px 96px;
  }
  h1.doc-title {
    font-size: 2rem;
    line-height: 1.2;
    margin: 0 0 0.5rem;
    font-family: Georgia, serif;
  }
  .doc-meta {
    color: #78716c;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 0.8rem;
    margin-bottom: 2.5rem;
    border-bottom: 1px solid #e7e5e4;
    padding-bottom: 1rem;
  }
  h1, h2, h3, h4 { line-height: 1.25; margin: 2em 0 0.6em; }
  h1 { font-size: 1.7rem; } h2 { font-size: 1.4rem; } h3 { font-size: 1.15rem; }
  p { margin: 0 0 1.1em; }
  img, canvas { max-width: 100%; height: auto; border-radius: 8px; }
  figure { margin: 1.5em 0; text-align: center; }
  figcaption { color: #78716c; font-size: 0.85rem; margin-top: 0.5em; }
  pre {
    background: #1c1917; color: #fafaf9;
    padding: 16px 18px; border-radius: 10px;
    overflow-x: auto; font-size: 0.85rem; line-height: 1.5;
  }
  code { font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; }
  p code, li code, td code {
    background: #f0eeec; border-radius: 4px; padding: 0.1em 0.35em; font-size: 0.9em;
  }
  blockquote {
    margin: 1.5em 0; padding: 0.2em 0 0.2em 1.2em;
    border-left: 3px solid #d6d3d1; color: #57534e;
  }
  table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
  th, td { border: 1px solid #e7e5e4; padding: 8px 12px; text-align: left; }
  th { background: #f5f4f2; font-family: -apple-system, sans-serif; font-size: 0.85rem; }
  tr:nth-child(even) td { background: #fafaf9; }
  hr { border: none; border-top: 1px solid #e7e5e4; margin: 2.5em 0; }
  a { color: #b45309; }
  @media print {
    body { background: #fff; }
    main { padding: 0; max-width: none; }
    h2, h3 { break-after: avoid; }
    pre, blockquote, img, table { break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
  <h1 class="doc-title">${escapeHtml(title)}</h1>
  <div class="doc-meta">Exported from wordPlay · ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  ${bodyHtml}
</main>
</body>
</html>`;
}

function safeFileName(title: string): string {
  return (title || 'document').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'document';
}

export function downloadStandaloneHtml(title: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(title)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Renders the standalone document in a hidden iframe and opens the browser's
// print dialog against it — the reliable route to PDF (charts and inlined
// images included).
export function printStandaloneHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Could not create print frame');
  }
  doc.open();
  doc.write(html);
  doc.close();
  const printAndCleanup = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => document.body.removeChild(iframe), 60_000);
    }
  };
  if (doc.readyState === 'complete') {
    setTimeout(printAndCleanup, 150);
  } else {
    iframe.onload = () => setTimeout(printAndCleanup, 150);
  }
}

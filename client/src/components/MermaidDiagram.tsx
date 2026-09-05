import { useEffect, useRef, useState } from 'react';

interface MermaidDiagramProps {
  code: string;
  isDark: boolean;
}

let mermaidModule: any = null;
let renderCounter = 0;

/**
 * Renders fenced ```mermaid blocks as diagrams. Any LLM can emit mermaid as
 * plain text, so this works with every provider and persists as portable
 * markdown in the document.
 */
export default function MermaidDiagram({ code, isDark }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!mermaidModule) {
          mermaidModule = (await import('mermaid')).default;
          mermaidModule.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'base',
            fontFamily: 'Georgia, serif',
            themeVariables: {
              primaryColor: '#f5f4f2',
              primaryTextColor: '#1c1917',
              primaryBorderColor: '#d6d3d1',
              lineColor: '#78716c',
              secondaryColor: '#f0eeec',
              tertiaryColor: '#fafaf9',
            },
          });
        }
        const id = `mermaid-${++renderCounter}`;
        const { svg: rendered } = await mermaidModule.render(id, code);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Diagram could not be rendered');
          setSvg(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, isDark]);

  if (error) {
    return (
      <div className="my-4 p-4 border border-amber-200 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-900/20">
        <div className="text-amber-700 dark:text-amber-400 text-sm font-medium mb-2">
          Mermaid diagram error — {error}
        </div>
        <pre className="text-xs text-stone-600 dark:text-stone-300 overflow-auto">{code}</pre>
      </div>
    );
  }

  return (
    <figure className="my-8 p-6 rounded-2xl bg-gradient-to-br from-white to-stone-50 dark:from-stone-800 dark:to-stone-900 shadow-lg border border-stone-100 dark:border-stone-700 text-center">
      <div className="mb-3 text-xs font-medium text-stone-500 dark:text-stone-400 flex items-center justify-center gap-2">
        <div className="w-2 h-2 bg-[var(--wp-copper)] rounded-full" />
        Diagram
      </div>
      <div
        ref={containerRef}
        className="mermaid-output overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
        // mermaid output is SVG generated locally with securityLevel:'strict'
        dangerouslySetInnerHTML={{ __html: svg || '<div style="padding:3rem;color:#a8a29e">Rendering diagram…</div>' }}
      />
    </figure>
  );
}

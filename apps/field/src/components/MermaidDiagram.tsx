import { useEffect, useId, useRef, useState } from 'react';

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) {
      return;
    }

    setError(null);
    container.replaceChildren();

    void import('mermaid')
      .then(async (module) => {
        const mermaid = module.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
        });

        const { svg } = await mermaid.render(`mermaid-${diagramId}`, chart.trim());
        if (cancelled) {
          return;
        }

        container.innerHTML = svg;
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to render diagram.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart, diagramId]);

  return (
    <div className="mermaid-diagram" role="img" aria-label="Workflow diagram">
      {error ? <p className="hint">{error}</p> : null}
      <div ref={containerRef} className="mermaid-diagram__canvas" />
    </div>
  );
}

import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './MermaidDiagram.js';

interface MarkdownContentProps {
  markdown: string;
}

function MarkdownCode({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
  const language = /language-(\w+)/.exec(className ?? '')?.[1];
  if (language === 'mermaid') {
    return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

export function MarkdownContent({ markdown }: MarkdownContentProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: MarkdownCode,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

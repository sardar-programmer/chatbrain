import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-xl border border-white/10 bg-sidebar/95 shadow-lg overflow-hidden text-left font-mono text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-sidebar-accent/60 border-b border-white/5 text-text-tertiary">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code block"
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-text-tertiary hover:text-text-primary hover:bg-white/10 transition-colors focus:outline-none"
        >
          {copied ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-text-primary leading-relaxed">
        <pre className="m-0 font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

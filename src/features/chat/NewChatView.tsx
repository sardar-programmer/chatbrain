import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Composer, ComposerAttachment } from '../../components/shared/Composer';

const PROMPT_SUGGESTIONS = [
  'Explain a concept',
  'Help me debug code',
  'Plan a project',
  'Summarize text',
];

export const NewChatView: React.FC = () => {
  const [activePrompt, setActivePrompt] = useState<string | undefined>(undefined);

  const handleSubmit = (content: string, _attachments: ComposerAttachment[]) => {
    console.log('Composer submitted:', content);
  };

  const handleChipClick = (suggestion: string) => {
    setActivePrompt(suggestion);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] px-4 py-8 sm:py-12 max-w-2xl mx-auto text-center w-full">
      {/* Emblem */}
      <div className="flex h-12 w-12 items-center justify-center rounded-card bg-accent-soft text-accent mb-4 shadow-subtle">
        <Sparkles className="h-6 w-6 stroke-[1.75]" />
      </div>

      {/* Greeting */}
      <h1 className="font-serif text-2xl sm:text-3xl font-medium text-text-primary mb-2 tracking-tight">
        How can I help you today?
      </h1>
      <p className="text-xs sm:text-sm text-text-secondary mb-6 sm:mb-8 max-w-md leading-relaxed">
        Start a new conversation, explore data science topics, or debug code.
      </p>

      {/* Chat Composer */}
      <div className="w-full mb-5">
        <Composer
          placeholder="Ask anything or request data analysis..."
          onSubmit={handleSubmit}
          autoFocus
          key={activePrompt}
        />
      </div>

      {/* Prompt Suggestion Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6 max-w-lg">
        {PROMPT_SUGGESTIONS.map(chip => (
          <button
            key={chip}
            type="button"
            onClick={() => handleChipClick(chip)}
            className="rounded-md border border-border/70 bg-surface px-3 py-1.5 text-xs text-text-secondary hover:bg-sidebar-accent hover:text-text-primary hover:border-border transition-all shadow-subtle active:scale-95"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
};

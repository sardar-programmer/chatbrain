import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Code2, FileText, Lightbulb, Sparkles } from 'lucide-react';
import { Composer } from '../../components/shared/Composer';
import { createConversation } from '../../services/api/client';

interface Suggestion {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
}

const PROMPT_SUGGESTIONS: Suggestion[] = [
  {
    label: 'Explain a concept',
    icon: Lightbulb,
    prompt: 'Explain how attention mechanisms work in transformers with an intuitive analogy.',
  },
  {
    label: 'Help me debug code',
    icon: Code2,
    prompt: 'Can you help me review and debug this code logic?',
  },
  {
    label: 'Plan a project',
    icon: ClipboardCheck,
    prompt: 'Help me plan the technical architecture and milestones for a new project.',
  },
  {
    label: 'Summarize text',
    icon: FileText,
    prompt: 'Please summarize the key takeaways from this text into concise bullet points.',
  },
];

export const NewChatView: React.FC = () => {
  const [activePrompt, setActivePrompt] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (content: string) => {
    if (!content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const conv = await createConversation(content.slice(0, 40));
      navigate(`/chat/${conv.id}`, { state: { initialPrompt: content } });
    } catch {
      // If offline or backend error, navigate with fallback temporary id
      const tempId = Math.random().toString(36).substring(2, 10);
      navigate(`/chat/${tempId}`, { state: { initialPrompt: content } });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChipClick = (prompt: string) => {
    setActivePrompt(prompt);
  };

  return (
    <div className="g-rise flex flex-col items-center justify-center min-h-[calc(100dvh-5rem)] px-4 py-8 sm:py-12 max-w-[900px] mx-auto text-center w-full">
      {/* Sparkle Icon in .glass-icon-tile */}
      <div className="glass-icon-tile text-accent mb-6">
        <Sparkles className="h-8 w-8 stroke-[1.75]" />
      </div>

      {/* Heading in Newsreader Serif Font - clamped ~2.35rem */}
      <h1 className="font-serif text-[clamp(1.75rem,3.2vw,2.35rem)] font-normal text-text-primary mb-2.5 tracking-tight">
        How can I help you today?
      </h1>

      {/* Muted Subtext */}
      <p className="text-xs sm:text-sm text-text-secondary mb-8 max-w-md leading-relaxed">
        Start a new conversation, explore data science topics, or debug code.
      </p>

      {/* Floating Glass Composer - max width about 900px */}
      <div className="w-full max-w-[900px] mb-6">
        <Composer
          className="max-w-[900px]"
          initialValue={activePrompt}
          onSubmit={handleSubmit}
          disabled={isSubmitting}
          autoFocus
        />
      </div>

      {/* 4 Glass Suggestion Chips: ONE row at >=1024px, same max width 900px, 8px gap, padding 0.5rem 0.85rem, font 14px */}
      <div className="w-full max-w-[900px] flex flex-wrap lg:flex-nowrap items-center justify-center gap-2">
        {PROMPT_SUGGESTIONS.map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => handleChipClick(s.prompt)}
              className="glass-chip text-[14px] font-normal text-text-secondary hover:text-text-primary cursor-pointer select-none px-[0.85rem] py-[0.5rem] whitespace-nowrap shrink-0 lg:shrink flex-1 lg:flex-initial justify-center gap-2"
            >
              <Icon className="h-4 w-4 text-accent shrink-0" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

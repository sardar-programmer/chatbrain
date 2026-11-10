export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // base64 data url
  isImage: boolean;
}

export interface Artifact {
  id: string;
  title: string;
  type: 'html' | 'svg' | 'code' | 'markdown';
  content: string;
  language?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: FileAttachment[];
  artifacts?: Artifact[];
  modelUsed?: string;
  durationMs?: number;
  tokens?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  model: string;
  temperature: number;
  systemPrompt?: string;
  messages: Message[];
}

export interface SystemPromptPreset {
  id: string;
  title: string;
  icon: string;
  description: string;
  prompt: string;
}

export interface AppSettings {
  apiKey: string;
  temperature: number;
  systemPrompt: string;
  theme: 'dark' | 'light';
  speechVoice: string;
  speechRate: number;
  autoScroll: boolean;
}

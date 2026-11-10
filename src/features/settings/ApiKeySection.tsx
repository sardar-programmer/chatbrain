import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { SectionCard } from '../../components/shared/SectionCard';
import { useToast } from '../../components/shared/Toast';
import {
  useCredentials,
  useDeleteKeyMutation,
  useSaveKeyMutation,
  useTestKeyMutation,
} from './hooks/useCredentials';

export const ApiKeySection: React.FC = () => {
  const { data: credentials, isLoading } = useCredentials();
  const saveMutation = useSaveKeyMutation();
  const testMutation = useTestKeyMutation();
  const deleteMutation = useDeleteKeyMutation();
  const { showToast } = useToast();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clear typed key from memory when unmounting
  useEffect(() => {
    return () => {
      setApiKeyInput('');
    };
  }, []);

  const isConfigured = Boolean(credentials?.configured);
  const hint = credentials?.hint;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setErrorMessage('Please enter an API key');
      return;
    }

    setErrorMessage(null);
    try {
      await saveMutation.mutateAsync(cleanKey);
      setApiKeyInput('');
      setShowKey(false);
      showToast({ message: 'Gemini API key validated and saved successfully', type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to validate API key';
      setErrorMessage(msg);
      showToast({ message: msg, type: 'error' });
    }
  };

  const handleTest = async () => {
    setErrorMessage(null);
    try {
      const res = await testMutation.mutateAsync();
      showToast({ message: res.message || 'Connection test successful', type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      setErrorMessage(msg);
      showToast({ message: msg, type: 'error' });
    }
  };

  const handleDelete = async () => {
    setErrorMessage(null);
    try {
      await deleteMutation.mutateAsync();
      showToast({ message: 'API key removed', type: 'info' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove API key';
      setErrorMessage(msg);
      showToast({ message: msg, type: 'error' });
    }
  };

  return (
    <SectionCard
      title="Gemini API Key"
      description="Write-only key input. Keys are stored locally on your machine (data/secrets) and never sent anywhere except to Google."
    >
      <div className="space-y-4">
        {/* Status bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-surface/50 dark:bg-surface/30 backdrop-blur-md p-3.5 border border-white/60 dark:border-white/10 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                isConfigured
                  ? 'bg-status-success/15 border-status-success/30 text-status-success'
                  : 'bg-surface/80 border-border/40 text-text-tertiary'
              }`}
            >
              {isConfigured ? <ShieldCheck className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-xs font-medium text-text-primary">
                {isLoading ? (
                  <span className="text-text-tertiary">Checking status...</span>
                ) : isConfigured ? (
                  <span>
                    Gemini key: <strong className="text-text-primary">Configured</strong>{' '}
                    <span className="font-mono text-[11px] text-text-secondary">(•••• {hint})</span>
                  </span>
                ) : (
                  <span>Gemini key: <span className="text-text-secondary">Not configured</span></span>
                )}
              </div>
              <p className="text-[11px] text-text-tertiary mt-0.5">
                {isConfigured
                  ? 'Key is verified and active for local model queries.'
                  : 'Enter a Gemini API key to enable AI tutoring and chat.'}
              </p>
            </div>
          </div>

          {isConfigured && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTest}
                disabled={testMutation.isPending}
                className="inline-flex items-center rounded-lg border border-white/60 dark:border-white/10 bg-surface/70 hover:bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-all disabled:opacity-50 shadow-sm"
              >
                {testMutation.isPending ? 'Testing...' : 'Test connection'}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1 rounded-lg border border-status-error/30 bg-status-error/5 hover:bg-status-error/15 px-3 py-1.5 text-xs font-medium text-status-error transition-all disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSave} className="space-y-3 max-w-lg">
          <div>
            <label htmlFor="gemini-key-input" className="block text-xs font-medium text-text-secondary mb-1">
              {isConfigured ? 'Update API Key' : 'Enter API Key'}
            </label>
            <div className="relative">
              <input
                id="gemini-key-input"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder={isConfigured ? 'Enter new key to replace existing...' : 'AIzaSy...'}
                className="w-full rounded-xl border border-white/60 dark:border-white/10 bg-surface/60 dark:bg-surface/30 backdrop-blur-md px-3.5 py-2 pr-10 text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30 transition-all shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors focus:outline-none"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-status-error/10 border border-status-error/20 p-2.5 text-xs text-status-error">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="submit"
              disabled={saveMutation.isPending || !apiKeyInput.trim()}
              className="bg-accent hover:bg-accent-hover text-white shadow-sm inline-flex items-center rounded-lg px-4 py-2 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saveMutation.isPending ? 'Validating...' : 'Save & validate'}
            </button>
            {apiKeyInput && (
              <button
                type="button"
                onClick={() => {
                  setApiKeyInput('');
                  setErrorMessage(null);
                }}
                className="inline-flex items-center rounded-lg border border-border/50 bg-surface/60 px-3 py-2 text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Remove Gemini API Key"
        description="This will delete data/secrets/gemini.key from this machine. You will need to re-enter a key to use AI features."
        confirmText="Remove key"
        isDestructive
        onConfirm={handleDelete}
      />
    </SectionCard>
  );
};

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
      showToast({ message: 'API key removed and models cache cleared', type: 'info' });
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md bg-sidebar/50 p-3 border border-border/50">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-card ${
                isConfigured ? 'bg-status-success/10 text-status-success' : 'bg-sidebar text-text-tertiary'
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
                className="inline-flex items-center rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-sidebar-accent transition-colors disabled:opacity-50"
              >
                {testMutation.isPending ? 'Testing...' : 'Test connection'}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-status-error/30 bg-surface px-2.5 py-1 text-xs font-medium text-status-error hover:bg-status-error/10 transition-colors disabled:opacity-50"
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
                className="w-full rounded-md border border-border bg-sidebar px-3 py-1.5 pr-10 text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(prev => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-md bg-status-error/10 border border-status-error/20 p-2 text-xs text-status-error">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="submit"
              disabled={saveMutation.isPending || !apiKeyInput.trim()}
              className="inline-flex items-center rounded-md bg-accent px-3.5 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
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
                className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors"
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
        description="This will delete data/secrets/gemini.key from this machine and clear the cached models registry. You will need to re-enter a key to use AI features."
        confirmText="Remove key"
        isDestructive
        onConfirm={handleDelete}
      />
    </SectionCard>
  );
};

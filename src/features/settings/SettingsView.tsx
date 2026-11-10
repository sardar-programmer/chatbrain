import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { ApiKeySection } from './ApiKeySection';
import { AppearanceSection } from './AppearanceSection';

export const SettingsView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your Gemini API key and appearance."
      />

      <ApiKeySection />
      <AppearanceSection />
    </div>
  );
};

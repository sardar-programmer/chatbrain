import React from 'react';
import { KeyRound, Terminal } from 'lucide-react';
import { SectionCard } from '../../components/shared/SectionCard';
import type { StatusResponse } from '../../services/api/types';

interface StatusDiagnosticsGridProps {
  status: StatusResponse;
}

export const StatusDiagnosticsGrid: React.FC<StatusDiagnosticsGridProps> = ({ status }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Backend API */}
      <SectionCard title="Backend API" noPadding className="p-4">
        <div className="flex items-center gap-2 mt-1">
          <span className="h-2 w-2 rounded-full bg-status-success" />
          <span className="text-xs font-medium text-text-primary">Connected</span>
        </div>
        <p className="text-[11px] font-mono text-text-tertiary mt-1">127.0.0.1:8000</p>
      </SectionCard>

      {/* Database Health */}
      <SectionCard title="SQLite Database" noPadding className="p-4">
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`h-2 w-2 rounded-full ${
              status.db ? 'bg-status-success' : 'bg-status-error'
            }`}
          />
          <span className="text-xs font-medium text-text-primary">
            {status.db ? 'Healthy (WAL)' : 'Unavailable'}
          </span>
        </div>
        <p className="text-[11px] font-mono text-text-tertiary mt-1">data/app.db</p>
      </SectionCard>

      {/* Python Runtime */}
      <SectionCard title="Python Runtime" noPadding className="p-4">
        <div className="flex items-center gap-2 mt-1">
          <Terminal className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-mono font-medium text-text-primary">
            v{status.python_version}
          </span>
        </div>
        <p className="text-[11px] text-text-tertiary mt-1">FastAPI Engine</p>
      </SectionCard>

      {/* Gemini Key Configured */}
      <SectionCard title="Gemini Credential" noPadding className="p-4">
        <div className="flex items-center gap-2 mt-1">
          <KeyRound
            className={`h-3.5 w-3.5 ${
              status.key_configured ? 'text-status-success' : 'text-text-tertiary'
            }`}
          />
          <span className="text-xs font-medium text-text-primary">
            {status.key_configured ? 'Configured' : 'Missing'}
          </span>
        </div>
        <p className="text-[11px] text-text-tertiary mt-1">Write-only (data/secrets)</p>
      </SectionCard>
    </div>
  );
};

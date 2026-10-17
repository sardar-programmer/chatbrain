import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { queryClient } from '../state/queryClient';
import { ToastProvider } from '../components/shared/Toast';
import { ErrorBoundary } from './ErrorBoundary';
import { AppRoutes } from './routes';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Tooltip.Provider delayDuration={150}>
          <ToastProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ToastProvider>
        </Tooltip.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

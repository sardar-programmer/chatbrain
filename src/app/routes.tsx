import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Loader } from '../components/shared/Loader';

function lazyRoute<T extends React.ComponentType>(
  importFn: () => Promise<{ [key: string]: T }>,
  exportName: string,
) {
  return lazy(async () => {
    const mod = await importFn();
    return { default: mod[exportName] };
  });
}

function withSuspense(Component: React.ComponentType, message: string) {
  return (
    <Suspense fallback={<Loader message={message} />}>
      <Component />
    </Suspense>
  );
}

// Minimal core routes
const NewChatView = lazyRoute(() => import('../features/chat/NewChatView'), 'NewChatView');
const ChatView = lazyRoute(() => import('../features/chat/ChatView'), 'ChatView');
const SettingsView = lazyRoute(() => import('../features/settings/SettingsView'), 'SettingsView');
const NotFoundView = lazyRoute(() => import('../features/not-found/NotFoundView'), 'NotFoundView');

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={withSuspense(NewChatView, 'Preparing conversation...')} />
        <Route path="/chat/:id" element={withSuspense(ChatView, 'Loading conversation...')} />
        <Route path="/settings" element={withSuspense(SettingsView, 'Loading Settings...')} />
        <Route path="*" element={withSuspense(NotFoundView, 'Loading...')} />
      </Route>
    </Routes>
  );
};

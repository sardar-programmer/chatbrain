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

// Route components loaded on-demand
const HomeView = lazyRoute(() => import('../features/home/HomeView'), 'HomeView');
const NewChatView = lazyRoute(() => import('../features/chat/NewChatView'), 'NewChatView');
const ChatView = lazyRoute(() => import('../features/chat/ChatView'), 'ChatView');
const HistoryView = lazyRoute(() => import('../features/history/HistoryView'), 'HistoryView');
const DSChatView = lazyRoute(() => import('../features/data-science/DSChatView'), 'DSChatView');
const WorkbenchView = lazyRoute(() => import('../features/data-science/WorkbenchView'), 'WorkbenchView');
const DatasetsView = lazyRoute(() => import('../features/datasets/DatasetsView'), 'DatasetsView');
const VisualizeView = lazyRoute(() => import('../features/visualization/VisualizeView'), 'VisualizeView');
const PythonLabView = lazyRoute(() => import('../features/python-lab/PythonLabView'), 'PythonLabView');
const SQLLabView = lazyRoute(() => import('../features/sql-lab/SQLLabView'), 'SQLLabView');
const MLStudioView = lazyRoute(() => import('../features/ml/MLStudioView'), 'MLStudioView');
const NotebookView = lazyRoute(() => import('../features/notebook/NotebookView'), 'NotebookView');
const ProjectsView = lazyRoute(() => import('../features/projects/ProjectsView'), 'ProjectsView');
const FilesView = lazyRoute(() => import('../features/files/FilesView'), 'FilesView');
const MemoryView = lazyRoute(() => import('../features/memory/MemoryView'), 'MemoryView');
const ImageGenView = lazyRoute(() => import('../features/media/ImageGenView'), 'ImageGenView');
const VideoGenView = lazyRoute(() => import('../features/media/VideoGenView'), 'VideoGenView');
const MediaLibraryView = lazyRoute(() => import('../features/media/MediaLibraryView'), 'MediaLibraryView');
const AnalyticsView = lazyRoute(() => import('../features/analytics/AnalyticsView'), 'AnalyticsView');
const ModelsView = lazyRoute(() => import('../features/models/ModelsView'), 'ModelsView');
const APIKeysView = lazyRoute(() => import('../features/settings/APIKeysView'), 'APIKeysView');
const SettingsView = lazyRoute(() => import('../features/settings/SettingsView'), 'SettingsView');
const StatusView = lazyRoute(() => import('../features/settings/StatusView'), 'StatusView');
const NotFoundView = lazyRoute(() => import('../features/not-found/NotFoundView'), 'NotFoundView');

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={withSuspense(HomeView, 'Opening launchpad...')} />
        <Route path="/chat/new" element={withSuspense(NewChatView, 'Preparing conversation...')} />
        <Route path="/chat/:id" element={withSuspense(ChatView, 'Loading conversation...')} />
        <Route path="/history" element={withSuspense(HistoryView, 'Loading history...')} />
        <Route path="/ds-chat" element={withSuspense(DSChatView, 'Loading Data Science Chat...')} />
        <Route path="/workbench" element={withSuspense(WorkbenchView, 'Initializing Workbench...')} />
        <Route path="/datasets" element={withSuspense(DatasetsView, 'Loading Dataset Analyzer...')} />
        <Route path="/visualize" element={withSuspense(VisualizeView, 'Preparing Visualizer...')} />
        <Route path="/python-lab" element={withSuspense(PythonLabView, 'Loading Python Lab...')} />
        <Route path="/sql-lab" element={withSuspense(SQLLabView, 'Loading SQL Lab...')} />
        <Route path="/ml-studio" element={withSuspense(MLStudioView, 'Loading ML Studio...')} />
        <Route path="/notebook" element={withSuspense(NotebookView, 'Loading Notebook...')} />
        <Route path="/projects" element={withSuspense(ProjectsView, 'Loading Projects...')} />
        <Route path="/projects/:id" element={withSuspense(ProjectsView, 'Loading Project...')} />
        <Route path="/files" element={withSuspense(FilesView, 'Loading Files...')} />
        <Route path="/memory" element={withSuspense(MemoryView, 'Accessing Memory...')} />
        <Route path="/image-gen" element={withSuspense(ImageGenView, 'Loading Image Generation...')} />
        <Route path="/video-gen" element={withSuspense(VideoGenView, 'Loading Video Generation...')} />
        <Route path="/media-library" element={withSuspense(MediaLibraryView, 'Loading Media Library...')} />
        <Route path="/analytics" element={withSuspense(AnalyticsView, 'Loading Analytics...')} />
        <Route path="/models" element={withSuspense(ModelsView, 'Loading Models...')} />
        <Route path="/api-keys" element={withSuspense(APIKeysView, 'Loading API Management...')} />
        <Route path="/settings" element={withSuspense(SettingsView, 'Loading Settings...')} />
        <Route path="/status" element={withSuspense(StatusView, 'Checking System Status...')} />
        <Route path="*" element={withSuspense(NotFoundView, 'Loading...')} />
      </Route>
    </Routes>
  );
};

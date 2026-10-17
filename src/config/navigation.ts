export type NavGroup = 'Data Science' | 'Labs' | 'Creative' | 'Workspace';

export interface NavItem {
  id: string;
  label: string;
  iconName: string;
  route: string;
  group?: NavGroup;
  blurb: string;
  comingSoon?: boolean;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    iconName: 'LayoutDashboard',
    route: '/',
    blurb: 'Launchpad and recent activity',
  },
  {
    id: 'history',
    label: 'Chat History',
    iconName: 'History',
    route: '/history',
    blurb: 'Browse past conversations and sessions',
  },
];

export const WORKSPACE_NAV_ITEMS: NavItem[] = [
  // Data Science Group
  {
    id: 'ds-chat',
    label: 'Data Science Chat',
    iconName: 'Sparkles',
    route: '/ds-chat',
    group: 'Data Science',
    blurb: 'Contextual AI assistance for data analysis and modeling',
  },
  {
    id: 'workbench',
    label: 'Workbench',
    iconName: 'Workflow',
    route: '/workbench',
    group: 'Data Science',
    blurb: '10-step full lifecycle data science pipeline stepper',
  },
  {
    id: 'datasets',
    label: 'Dataset Analyzer',
    iconName: 'Database',
    route: '/datasets',
    group: 'Data Science',
    blurb: 'Automated profiling, statistics, correlations, and data preview',
  },
  {
    id: 'visualize',
    label: 'Visualization Studio',
    iconName: 'BarChart3',
    route: '/visualize',
    group: 'Data Science',
    blurb: 'Interactive chart builder powered by Plotly',
  },

  // Labs Group
  {
    id: 'python-lab',
    label: 'Python Lab',
    iconName: 'Terminal',
    route: '/python-lab',
    group: 'Labs',
    blurb: 'Monaco-powered Python script development workspace',
  },
  {
    id: 'sql-lab',
    label: 'SQL Lab',
    iconName: 'Table2',
    route: '/sql-lab',
    group: 'Labs',
    blurb: 'Schema browser, query editor, and execution plans',
  },
  {
    id: 'ml-studio',
    label: 'ML Studio',
    iconName: 'Cpu',
    route: '/ml-studio',
    group: 'Labs',
    blurb: 'Machine learning task setup, training, and model comparison',
  },
  {
    id: 'notebook',
    label: 'Notebook',
    iconName: 'BookOpen',
    route: '/notebook',
    group: 'Labs',
    blurb: 'Interactive computation cells for code, markdown, and outputs',
  },

  // Creative Group
  {
    id: 'image-gen',
    label: 'Image Generation',
    iconName: 'Image',
    route: '/image-gen',
    group: 'Creative',
    blurb: 'Prompt composer and creative vision generation',
  },
  {
    id: 'video-gen',
    label: 'Video Generation',
    iconName: 'Video',
    route: '/video-gen',
    group: 'Creative',
    blurb: 'Text-to-video motion and scene synthesizer',
  },
  {
    id: 'media-library',
    label: 'Media Library',
    iconName: 'Film',
    route: '/media-library',
    group: 'Creative',
    blurb: 'Browse, filter, and preview generated media assets',
  },

  // Workspace Group
  {
    id: 'projects',
    label: 'Projects',
    iconName: 'FolderGit2',
    route: '/projects',
    group: 'Workspace',
    blurb: 'Organized hubs grouping notebooks, datasets, and chats',
  },
  {
    id: 'files',
    label: 'Files',
    iconName: 'FolderOpen',
    route: '/files',
    group: 'Workspace',
    blurb: 'Unified local workspace file manager and inspector',
  },
  {
    id: 'memory',
    label: 'Memory',
    iconName: 'BrainCircuit',
    route: '/memory',
    group: 'Workspace',
    blurb: 'Persistent personal knowledge base and custom instructions',
  },
];

export const SYSTEM_NAV_ITEMS: NavItem[] = [
  {
    id: 'models',
    label: 'Models',
    iconName: 'Boxes',
    route: '/models',
    blurb: 'Available model list and capability specifications',
  },
  {
    id: 'api-keys',
    label: 'API Management',
    iconName: 'KeyRound',
    route: '/api-keys',
    blurb: 'Manage API access keys stored strictly on this machine',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    iconName: 'LineChart',
    route: '/analytics',
    blurb: 'Usage metrics, token counts, and conversation analytics',
  },
  {
    id: 'settings',
    label: 'Settings',
    iconName: 'Settings',
    route: '/settings',
    blurb: 'Application preferences, theme, and data management',
  },
  {
    id: 'status',
    label: 'System Status',
    iconName: 'Activity',
    route: '/status',
    blurb: 'Service connectivity and local engine diagnostics',
  },
];

export const ALL_NAV_ITEMS = [...MAIN_NAV_ITEMS, ...WORKSPACE_NAV_ITEMS, ...SYSTEM_NAV_ITEMS];

import type { Model } from '../../services/api/types';

export const KIND_CHIPS = [
  { id: 'chat', label: 'Chat' },
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Image' },
  { id: 'audio', label: 'Audio' },
  { id: 'live', label: 'Live' },
  { id: 'embeddings', label: 'Embeddings' },
  { id: 'video', label: 'Video' },
  { id: 'music', label: 'Music' },
  { id: 'agent', label: 'Agent' },
  { id: 'research', label: 'Research' },
  { id: 'other', label: 'Other / Unknown' },
] as const;

export type KindFilterId = (typeof KIND_CHIPS)[number]['id'];

export function matchesKind(model: Model, filterId: KindFilterId): boolean {
  if (filterId === 'all') return true;
  if (filterId === 'other') {
    const knownKinds = [
      'chat',
      'image',
      'audio',
      'live',
      'embeddings',
      'video',
      'music',
      'agent',
      'research',
    ];
    return !knownKinds.includes(model.kind.toLowerCase());
  }
  return model.kind.toLowerCase() === filterId.toLowerCase();
}

export function countByKind(models: Model[]): Record<KindFilterId, number> {
  const counts: Record<string, number> = {
    all: models.length,
    chat: 0,
    image: 0,
    audio: 0,
    live: 0,
    embeddings: 0,
    video: 0,
    music: 0,
    agent: 0,
    research: 0,
    other: 0,
  };

  for (const m of models) {
    const k = m.kind.toLowerCase();
    if (k in counts && k !== 'all' && k !== 'other') {
      counts[k] += 1;
    } else {
      counts.other += 1;
    }
  }

  return counts as Record<KindFilterId, number>;
}

export function filterModels(
  models: Model[],
  searchQuery: string,
  kindFilter: KindFilterId,
): Model[] {
  const query = searchQuery.trim().toLowerCase();

  return models.filter(m => {
    // 1. Kind match
    if (!matchesKind(m, kindFilter)) return false;

    // 2. Search match
    if (!query) return true;
    const matchesId = m.id.toLowerCase().includes(query);
    const matchesName = m.display_name.toLowerCase().includes(query);
    return matchesId || matchesName;
  });
}

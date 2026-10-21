import { describe, it, expect } from 'vitest';
import { countByKind, filterModels } from '../../features/models/modelFilter';
import type { Model } from '../../services/api/types';

function createMockModel(id: string, name: string, kind: string): Model {
  return {
    id,
    display_name: name,
    provider: 'gemini',
    capabilities: ['text'],
    input_token_limit: 1000,
    output_token_limit: 200,
    supported_actions: ['generateContent'],
    status: 'available',
    last_checked: '2026-10-21T00:00:00Z',
    kind,
    kind_inferred: false,
  };
}

describe('Model Filter & Counts', () => {
  const sampleModels: Model[] = [
    createMockModel('gemini-2.5-flash', 'Gemini 2.5 Flash', 'chat'),
    createMockModel('gemini-2.5-pro', 'Gemini 2.5 Pro', 'chat'),
    createMockModel('imagen-3.0', 'Imagen 3.0', 'image'),
    createMockModel('text-embedding-004', 'Text Embedding', 'embeddings'),
    createMockModel('custom-exotic-v1', 'Exotic Model', 'unknown'),
  ];

  it('correctly aggregates counts by kind', () => {
    const counts = countByKind(sampleModels);
    expect(counts.all).toBe(5);
    expect(counts.chat).toBe(2);
    expect(counts.image).toBe(1);
    expect(counts.embeddings).toBe(1);
    expect(counts.other).toBe(1);
    expect(counts.audio).toBe(0);
  });

  it('filters models by kind category', () => {
    const chatOnly = filterModels(sampleModels, '', 'chat');
    expect(chatOnly).toHaveLength(2);
    expect(chatOnly.map(m => m.id)).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);

    const imagesOnly = filterModels(sampleModels, '', 'image');
    expect(imagesOnly).toHaveLength(1);
    expect(imagesOnly[0].id).toBe('imagen-3.0');

    const otherOnly = filterModels(sampleModels, '', 'other');
    expect(otherOnly).toHaveLength(1);
    expect(otherOnly[0].id).toBe('custom-exotic-v1');

    const allModels = filterModels(sampleModels, '', 'all');
    expect(allModels).toHaveLength(5);
  });

  it('filters models by search query matching either ID or display name', () => {
    const matchedById = filterModels(sampleModels, 'embedding', 'all');
    expect(matchedById).toHaveLength(1);
    expect(matchedById[0].id).toBe('text-embedding-004');

    const matchedByName = filterModels(sampleModels, 'Flash', 'all');
    expect(matchedByName).toHaveLength(1);
    expect(matchedByName[0].id).toBe('gemini-2.5-flash');

    const matchedBothKindAndQuery = filterModels(sampleModels, 'pro', 'chat');
    expect(matchedBothKindAndQuery).toHaveLength(1);
    expect(matchedBothKindAndQuery[0].id).toBe('gemini-2.5-pro');

    const noMatch = filterModels(sampleModels, 'nonexistent', 'all');
    expect(noMatch).toHaveLength(0);
  });
});

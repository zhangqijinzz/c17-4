import type { StoryClue, StoryDocument, StoryScene, StoryStats } from './story';

export type ClueBoardFilter = 'unresolved' | 'all';

export interface ClueBoardEntry {
  clue: StoryClue;
  resolved: boolean;
  setupScene: StoryScene | null;
  payoffScene: StoryScene | null;
  /** 0-based position of the setup scene on the current timeline, or null when the scene is gone. */
  setupIndex: number | null;
  payoffIndex: number | null;
  /** Inclusive number of timeline scenes the thread stretches across; null when it cannot be located. */
  spanScenes: number | null;
  inverted: boolean;
  setupMissing: boolean;
  payoffMissing: boolean;
  /** Open thread whose setup sits far from the current writing frontier. */
  stale: boolean;
}

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

/**
 * Build the foreshadowing board straight from the timeline's current order,
 * so spans are always recomputed after scenes are moved rather than stored.
 */
export function buildClueBoard(story: StoryDocument): ClueBoardEntry[] {
  const scenes = orderedScenes(story);
  const sceneCount = scenes.length;
  const positionById = new Map(scenes.map((scene, index) => [scene.id, index]));
  const entries = story.clues.map((clue): ClueBoardEntry => {
    const setupIndex = clue.setupSceneId ? positionById.get(clue.setupSceneId) ?? null : null;
    const payoffIndex = clue.payoffSceneId ? positionById.get(clue.payoffSceneId) ?? null : null;
    const setupMissing = clue.setupSceneId !== '' && setupIndex === null;
    const payoffMissing = clue.payoffSceneId !== '' && payoffIndex === null;
    // A dangling endpoint cannot be treated as resolved; the thread must stay visible.
    const resolved = clue.payoffSceneId !== '' && !payoffMissing && !setupMissing;
    const inverted = setupIndex !== null && payoffIndex !== null && payoffIndex < setupIndex;
    const spanScenes = (() => {
      if (setupIndex === null) return null;
      if (payoffIndex !== null) return Math.abs(payoffIndex - setupIndex) + 1;
      return sceneCount - setupIndex;
    })();
    const ageRatio = setupIndex !== null && sceneCount > 0 ? (sceneCount - setupIndex) / sceneCount : null;
    const stale = !resolved
      && setupIndex !== null
      && (sceneCount - setupIndex >= 3 || (ageRatio !== null && ageRatio >= 0.6 && sceneCount - setupIndex >= 1));
    return {
      clue,
      resolved,
      setupScene: setupIndex === null ? null : scenes[setupIndex],
      payoffScene: payoffIndex === null ? null : scenes[payoffIndex],
      setupIndex,
      payoffIndex,
      spanScenes,
      inverted,
      setupMissing,
      payoffMissing,
      stale,
    };
  });
  return entries.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    // Broken references stay visible and rise to the top of their group.
    if (a.setupMissing !== b.setupMissing) return a.setupMissing ? -1 : 1;
    if (a.setupIndex === null && b.setupIndex === null) return a.clue.title.localeCompare(b.clue.title);
    if (a.setupIndex === null) return 1;
    if (b.setupIndex === null) return -1;
    if (a.setupIndex !== b.setupIndex) return a.setupIndex - b.setupIndex;
    return a.clue.title.localeCompare(b.clue.title);
  });
}

export function filterClueBoard(entries: ClueBoardEntry[], filter: ClueBoardFilter): ClueBoardEntry[] {
  if (filter === 'all') return entries;
  // A payoff pointing at a deleted scene counts as still open, never hidden.
  return entries.filter((entry) => !entry.resolved);
}

export function getStats(story: StoryDocument): StoryStats {
  const unresolvedClues = story.clues.filter((clue) => clue.payoffSceneId === '').length;
  const totalSignals = story.characters.length + story.scenes.length + story.clues.length;
  const completedSignals = story.characters.length + story.scenes.length + (story.clues.length - unresolvedClues);
  const completion = totalSignals === 0 ? 0 : Math.round((completedSignals / totalSignals) * 100);
  return {
    characters: story.characters.length,
    scenes: story.scenes.length,
    clues: story.clues.length,
    unresolvedClues,
    completion,
  };
}

export function validateName(value: string): string {
  const cleanValue = value.trim();
  return cleanValue.length < 2 ? '至少输入 2 个字' : cleanValue;
}

export function getTimelineWarning(story: StoryDocument): string | null {
  const orders = story.scenes.map((scene) => scene.order);
  return new Set(orders).size !== orders.length ? '时间线存在重复顺序，请重新排列。' : null;
}

export function sanitizeStory(input: unknown): StoryDocument | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<StoryDocument>;
  if (
    candidate.version !== 1 ||
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    !Array.isArray(candidate.characters) ||
    !Array.isArray(candidate.scenes) ||
    !Array.isArray(candidate.clues)
  ) {
    return null;
  }
  return candidate as StoryDocument;
}

import type { StoryClue, StoryDocument, StoryScene, StoryStats } from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

/** 伏笔悬而未决超过这么多个后续场景，就视为「快收不回来」。 */
export const CLUE_AGING_SCENES = 3;

export type ClueBoardGroup = 'dangling' | 'open' | 'closed';

export interface ClueBoardRow {
  clue: StoryClue;
  /** 埋下场景在时间线上的序号（从 0 开始）；场景已遗失时为 null。 */
  setupIndex: number | null;
  /** 回收场景在时间线上的序号（从 0 开始）；未回收或场景已遗失时为 null。 */
  payoffIndex: number | null;
  setupTitle: string;
  payoffTitle: string;
  setupMissing: boolean;
  payoffMissing: boolean;
  /** 跨度条终点：已回收为回收场景，未回收为时间线最后一幕。 */
  endIndex: number | null;
  /** 跨度覆盖的场景数（含首尾）；无法定位时为 0。 */
  spanScenes: number;
  /** 埋下之后又经过了多少个场景（不含埋下的那一幕）。 */
  distanceFromSetup: number;
  /** 回收点被排到了埋下点之前（时间线重排可能造成）。 */
  reversed: boolean;
  resolved: boolean;
  aging: boolean;
  group: ClueBoardGroup;
}

/**
 * 按时间线真实顺序计算每条伏笔的跨度。结果永远当场计算，
 * 时间线重排后再次调用即得到新数字，不保留任何旧缓存。
 */
export function getClueBoardRows(story: StoryDocument): ClueBoardRow[] {
  const scenes = orderedScenes(story);
  const indexById = new Map(scenes.map((scene, index) => [scene.id, index]));
  const lastIndex = scenes.length - 1;

  const rows = story.clues.map((clue): ClueBoardRow => {
    const setupIndex = indexById.get(clue.setupSceneId) ?? null;
    const hasPayoffRef = clue.payoffSceneId !== '';
    const payoffIndex = hasPayoffRef ? indexById.get(clue.payoffSceneId) ?? null : null;
    const setupMissing = setupIndex === null;
    const payoffMissing = hasPayoffRef && payoffIndex === null;
    // 回收场景指向了已不存在的场景，不能当作已回收。
    const resolved = hasPayoffRef && !payoffMissing && setupIndex !== null;
    const reversed = resolved && (payoffIndex as number) < (setupIndex as number);

    let endIndex: number | null = null;
    let spanScenes = 0;
    if (setupIndex !== null) {
      endIndex = resolved ? payoffIndex : lastIndex;
      spanScenes = endIndex === null ? 0 : Math.abs(endIndex - setupIndex) + 1;
    }
    const distanceFromSetup = setupIndex === null ? 0 : Math.max(0, lastIndex - setupIndex);
    const aging = !resolved && !setupMissing && distanceFromSetup >= CLUE_AGING_SCENES;
    const group: ClueBoardGroup = setupMissing ? 'dangling' : resolved ? 'closed' : 'open';

    return {
      clue,
      setupIndex,
      payoffIndex,
      setupTitle: setupIndex === null ? '' : scenes[setupIndex].title,
      payoffTitle: payoffIndex === null ? '' : scenes[payoffIndex].title,
      setupMissing,
      payoffMissing,
      endIndex,
      spanScenes,
      distanceFromSetup,
      reversed,
      resolved,
      aging,
      group,
    };
  });

  const groupRank: Record<ClueBoardGroup, number> = { dangling: 0, open: 1, closed: 2 };
  return rows.sort((a, b) => {
    if (groupRank[a.group] !== groupRank[b.group]) return groupRank[a.group] - groupRank[b.group];
    if (a.group === 'closed') {
      // 已回收的沉底，最近刚回收的相对靠上。
      if ((b.payoffIndex ?? -1) !== (a.payoffIndex ?? -1)) return (b.payoffIndex ?? -1) - (a.payoffIndex ?? -1);
    } else {
      // 还悬着：埋得越靠前越紧急。
      if ((a.setupIndex ?? Number.MAX_SAFE_INTEGER) !== (b.setupIndex ?? Number.MAX_SAFE_INTEGER)) {
        return (a.setupIndex ?? Number.MAX_SAFE_INTEGER) - (b.setupIndex ?? Number.MAX_SAFE_INTEGER);
      }
      if (b.spanScenes !== a.spanScenes) return b.spanScenes - a.spanScenes;
    }
    return a.clue.title.localeCompare(b.clue.title, 'zh-Hans-CN');
  });
}

export function getStats(story: StoryDocument): StoryStats {
  const sceneIds = new Set(story.scenes.map((scene) => scene.id));
  // 指向的场景已不存在时不能算作已回收，否则会把悬着的伏笔悄悄统计掉。
  const unresolvedClues = story.clues.filter(
    (clue) => !clue.payoffSceneId || !sceneIds.has(clue.payoffSceneId) || !sceneIds.has(clue.setupSceneId),
  ).length;
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

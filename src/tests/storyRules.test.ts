import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { buildClueBoard, filterClueBoard, getStats, getTimelineWarning, orderedScenes, sanitizeStory, validateName } from '../models/storyRules';

const OLD_HARBOR = 'scene-old-harbor';
const STORM = 'scene-storm';

describe('story domain rules', () => {
  it('sorts scenes and calculates unresolved clues', () => {
    const story = createStarterStory();
    story.scenes = [...story.scenes].reverse();
    expect(orderedScenes(story).map((scene) => scene.title)).toEqual(['旧港口的来信', '风暴前夜']);
    expect(getStats(story)).toMatchObject({ characters: 2, scenes: 2, clues: 1, unresolvedClues: 1, completion: 80 });
  });

  it('guards invalid names and duplicate timeline orders', () => {
    const story = createStarterStory();
    story.scenes[1].order = story.scenes[0].order;
    expect(validateName(' ')).toBe('至少输入 2 个字');
    expect(getTimelineWarning(story)).toContain('重复');
  });

  it('rejects corrupt persisted documents', () => {
    expect(sanitizeStory('{bad json}')).toBeNull();
    expect(sanitizeStory({ version: 99 })).toBeNull();
    expect(sanitizeStory(createStarterStory())).not.toBeNull();
  });

  it('measures clue spans in inclusive scene counts from the real timeline order', () => {
    const story = createStarterStory();
    story.scenes.push(
      { id: 'scene-c', title: '第三幕', order: 3, summary: '', conflict: '', characterIds: [], clueIds: [] },
      { id: 'scene-d', title: '第四幕', order: 4, summary: '', conflict: '', characterIds: [], clueIds: [] },
    );
    story.clues.push(
      { id: 'clue-paid', title: '罗盘刻痕', setupSceneId: STORM, payoffSceneId: 'scene-d' },
      { id: 'clue-earlier', title: '更晚埋下的线', setupSceneId: 'scene-c', payoffSceneId: '' },
    );
    const byId = Object.fromEntries(buildClueBoard(story).map((entry) => [entry.clue.id, entry]));
    expect(byId['clue-first-letter'].spanScenes).toBe(4); // open: setup scene 1 -> frontier scene 4
    expect(byId['clue-paid'].spanScenes).toBe(3); // scenes 2..4 inclusive
    expect(byId['clue-earlier'].spanScenes).toBe(2);
    expect(byId['clue-first-letter'].stale).toBe(true);
    expect(byId['clue-earlier'].stale).toBe(false);
  });

  it('recomputes spans from scratch after the timeline is reordered', () => {
    const story = createStarterStory();
    story.scenes.push({ id: 'scene-c', title: '第三幕', order: 3, summary: '', conflict: '', characterIds: [], clueIds: [] });
    story.clues.push({ id: 'clue-paid', title: '罗盘刻痕', setupSceneId: OLD_HARBOR, payoffSceneId: 'scene-c' });
    const before = Object.fromEntries(buildClueBoard(story).map((entry) => [entry.clue.id, entry]));
    expect(before['clue-paid'].spanScenes).toBe(3);

    // Swap the middle and closing scenes; spans must follow the new order rather than cached numbers.
    story.scenes = orderedScenes(story).map((scene) => {
      if (scene.id === 'scene-c') return { ...scene, order: 2 };
      if (scene.id === STORM) return { ...scene, order: 3 };
      return scene;
    });
    const after = Object.fromEntries(buildClueBoard(story).map((entry) => [entry.clue.id, entry]));
    expect(after['clue-paid'].spanScenes).toBe(2);
    expect(after['clue-paid'].setupIndex).toBe(0);
    expect(after['clue-paid'].payoffIndex).toBe(1);
    expect(after['clue-paid'].spanScenes).not.toBe(before['clue-paid'].spanScenes);
  });

  it('sorts open early-planted clues first and sinks resolved ones', () => {
    const story = createStarterStory();
    story.scenes.push(
      { id: 'scene-c', title: '第三幕', order: 3, summary: '', conflict: '', characterIds: [], clueIds: [] },
      { id: 'scene-d', title: '第四幕', order: 4, summary: '', conflict: '', characterIds: [], clueIds: [] },
    );
    story.clues.push(
      { id: 'clue-late-open', title: '新埋下的线', setupSceneId: 'scene-d', payoffSceneId: '' },
      { id: 'clue-resolved', title: '已经收网', setupSceneId: STORM, payoffSceneId: 'scene-c' },
    );
    const ids = buildClueBoard(story).map((entry) => entry.clue.id);
    expect(ids.indexOf('clue-first-letter')).toBeLessThan(ids.indexOf('clue-late-open'));
    expect(ids.indexOf('clue-late-open')).toBeLessThan(ids.indexOf('clue-resolved'));
  });

  it('never hides clues whose scenes no longer exist and treats dangling payoffs as open', () => {
    const story = createStarterStory();
    story.scenes.push({ id: 'scene-c', title: '第三幕', order: 3, summary: '', conflict: '', characterIds: [], clueIds: [] });
    story.clues.push(
      { id: 'clue-lost-payoff', title: '回收点丢失的线', setupSceneId: STORM, payoffSceneId: 'scene-gone' },
      { id: 'clue-lost-setup', title: '埋下点丢失的线', setupSceneId: 'scene-gone', payoffSceneId: 'scene-c' },
    );
    const board = buildClueBoard(story);
    const unresolved = filterClueBoard(board, 'unresolved');
    expect(unresolved.some((entry) => entry.clue.id === 'clue-lost-payoff')).toBe(true);
    expect(unresolved.some((entry) => entry.clue.id === 'clue-lost-setup')).toBe(true);
    const lostPayoff = board.find((entry) => entry.clue.id === 'clue-lost-payoff');
    expect(lostPayoff?.payoffMissing).toBe(true);
    expect(lostPayoff?.resolved).toBe(false);
    const lostSetup = board.find((entry) => entry.clue.id === 'clue-lost-setup');
    expect(lostSetup?.setupMissing).toBe(true);
    expect(lostSetup?.spanScenes).toBeNull();
  });
});

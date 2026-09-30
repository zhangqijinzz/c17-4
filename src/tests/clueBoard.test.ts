import { describe, expect, it } from 'vitest';
import type { StoryClue, StoryDocument, StoryScene } from '../models/story';
import { CLUE_AGING_SCENES, getClueBoardRows, orderedScenes } from '../models/storyRules';

function scene(id: string, order: number, title = `场景${id}`): StoryScene {
  return { id, title, order, summary: '', conflict: '', characterIds: [], clueIds: [] };
}

function clue(id: string, setupSceneId: string, payoffSceneId = '', title = `伏笔${id}`): StoryClue {
  return { id, title, setupSceneId, payoffSceneId };
}

function storyWith(scenes: StoryScene[], clues: StoryClue[]): StoryDocument {
  return {
    version: 1,
    id: 'test-story',
    title: '测试故事',
    status: 'draft',
    characters: [],
    scenes,
    clues,
    selectedSceneId: scenes[0]?.id ?? '',
    updatedAt: '',
  };
}

describe('clue board rows', () => {
  it('measures each clue span from real timeline positions', () => {
    const story = storyWith(
      [scene('s1', 1), scene('s2', 2), scene('s3', 3), scene('s4', 4), scene('s5', 5)],
      [clue('open', 's1'), clue('closed', 's1', 's4')],
    );
    const rows = getClueBoardRows(story);
    const open = rows.find((row) => row.clue.id === 'open');
    const closed = rows.find((row) => row.clue.id === 'closed');
    expect(open).toMatchObject({ setupIndex: 0, endIndex: 4, spanScenes: 5, distanceFromSetup: 4, aging: true, resolved: false });
    expect(closed).toMatchObject({ setupIndex: 0, payoffIndex: 3, endIndex: 3, spanScenes: 4, aging: false, resolved: true });
  });

  it('sorts dangling clues first, open clues by earliest setup, resolved clues sink', () => {
    const story = storyWith(
      [scene('s1', 1), scene('s2', 2), scene('s3', 3), scene('s4', 4), scene('s5', 5)],
      [
        clue('closed-late', 's2', 's5'),
        clue('open-near', 's3'),
        clue('setup-gone', 'gone'),
        clue('open-early', 's1'),
        clue('payoff-gone', 's2', 'removed'),
      ],
    );
    expect(getClueBoardRows(story).map((row) => row.clue.id)).toEqual([
      'setup-gone',
      'open-early',
      'payoff-gone',
      'open-near',
      'closed-late',
    ]);
  });

  it('flags only unresolved clues that have dragged across enough later scenes', () => {
    const scenes = [scene('s1', 1), scene('s2', 2), scene('s3', 3), scene('s4', 4), scene('s5', 5)];
    const story = storyWith(scenes, [
      clue('fresh', `s${6 - CLUE_AGING_SCENES}`),
      clue('old', 's1'),
    ]);
    const rows = getClueBoardRows(story);
    expect(rows.find((row) => row.clue.id === 'fresh')?.aging).toBe(false);
    expect(rows.find((row) => row.clue.id === 'old')?.aging).toBe(true);
  });

  it('keeps clues visible when their scenes no longer exist and treats lost payoff as unresolved', () => {
    const story = storyWith(
      [scene('s1', 1), scene('s2', 2)],
      [clue('setup-gone', 'removed'), clue('payoff-gone', 's1', 'removed')],
    );
    const rows = getClueBoardRows(story);
    expect(rows.map((row) => row.clue.id)).toEqual(['setup-gone', 'payoff-gone']);
    const setupGone = rows[0];
    const payoffGone = rows[1];
    expect(setupGone.setupMissing).toBe(true);
    expect(setupGone.spanScenes).toBe(0);
    expect(payoffGone.payoffMissing).toBe(true);
    expect(payoffGone.resolved).toBe(false);
  });

  it('marks payoff ordered before setup as reversed', () => {
    const story = storyWith(
      [scene('s1', 1), scene('s2', 2), scene('s3', 3), scene('s4', 4)],
      [clue('twisted', 's4', 's2')],
    );
    const row = getClueBoardRows(story)[0];
    expect(row.reversed).toBe(true);
    expect(row.spanScenes).toBe(3);
  });

  it('recomputes spans from scratch after the timeline is reordered', () => {
    const scenes = [scene('s1', 1), scene('s2', 2), scene('s3', 3), scene('s4', 4), scene('s5', 5)];
    const story = storyWith(scenes, [clue('moves-with-timeline', 's1')]);
    expect(getClueBoardRows(story)[0]).toMatchObject({ setupIndex: 0, spanScenes: 5, aging: true });

    const reordered = orderedScenes(story).slice(1);
    reordered.push(orderedScenes(story)[0]);
    story.scenes = reordered.map((item, index) => ({ ...item, order: index + 1 }));

    expect(getClueBoardRows(story)[0]).toMatchObject({ setupIndex: 4, spanScenes: 1, distanceFromSetup: 0, aging: false });
  });
});

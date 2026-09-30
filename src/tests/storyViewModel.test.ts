import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('filters the clue board without changing the selected scene in the workspace', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const setupId = viewModel.snapshot.story!.scenes[0].id;
    viewModel.selectScene(setupId);
    viewModel.setSection('clues');
    viewModel.setClueFilter('all');
    expect(viewModel.snapshot.story?.selectedSceneId).toBe(setupId);
    expect(viewModel.snapshot.clueFilter).toBe('all');
    const allRows = viewModel.clueBoardRows;
    viewModel.setClueFilter('unresolved');
    expect(viewModel.snapshot.story?.selectedSceneId).toBe(setupId);
    expect(viewModel.clueBoardRows.length).toBeLessThanOrEqual(allRows.length);
    expect(viewModel.clueBoardRows.every((row) => !row.resolved)).toBe(true);
  });

  it('never hides a clue whose referenced scene is gone, and focusScene returns to the overview', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const story = viewModel.snapshot.story!;
    const dangling = { id: 'clue-lost', title: '失落的细节', setupSceneId: 'scene-vanished', payoffSceneId: '' };
    story.clues.push(dangling);
    viewModel.setSection('clues');
    expect(viewModel.clueBoardRows.some((row) => row.clue.id === dangling.id)).toBe(true);
    const aliveSceneId = story.scenes[0].id;
    viewModel.focusScene(aliveSceneId);
    expect(viewModel.snapshot.activeSection).toBe('overview');
    expect(viewModel.snapshot.story?.selectedSceneId).toBe(aliveSceneId);
  });
});

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

  it('switches the clue board filter without changing the selected scene', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const selectedBefore = viewModel.snapshot.story?.selectedSceneId;
    expect(selectedBefore).toBeTruthy();

    viewModel.setClueFilter('all');
    expect(viewModel.clueFilter).toBe('all');
    expect(viewModel.snapshot.story?.selectedSceneId).toBe(selectedBefore);
    expect(viewModel.selectedScene?.title).toBe('地下档案室');

    viewModel.setClueFilter('unresolved');
    expect(viewModel.clueFilter).toBe('unresolved');
    expect(viewModel.snapshot.story?.selectedSceneId).toBe(selectedBefore);
  });

  it('recomputes board spans through the view model after scenes move', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const start = createStarterStory();
    const harbor = start.scenes[0].id;
    viewModel.addScene('第三幕', '收束。');
    const third = viewModel.snapshot.story?.scenes.find((scene) => scene.title === '第三幕')?.id ?? '';
    viewModel.addClue('长线伏笔', harbor, third);
    const paid = viewModel.clueBoardAll.find((entry) => entry.clue.title === '长线伏笔');
    expect(paid?.spanScenes).toBe(3);

    // Move the newly created last scene up one position.
    viewModel.moveScene(third, 'up');
    const moved = viewModel.clueBoardAll.find((entry) => entry.clue.title === '长线伏笔');
    expect(moved?.spanScenes).toBe(2);
  });
});

import { useEffect, useState } from 'react';
import type { ClueBoardRow } from '../models/storyRules';
import type { ClueFilter, StoryViewModel } from '../viewmodels/storyViewModel';

interface ClueKanbanProps {
  viewModel: StoryViewModel;
}

function sceneLabel(index: number | null): string {
  return index === null ? '' : `第 ${String(index + 1).padStart(2, '0')} 幕`;
}

function SpanTrack({ row, sceneCount }: { row: ClueBoardRow; sceneCount: number }) {
  if (row.setupIndex === null || row.endIndex === null || sceneCount < 2) return null;
  const denom = sceneCount - 1;
  const left = (row.setupIndex / denom) * 100;
  const width = (Math.abs(row.endIndex - row.setupIndex) / denom) * 100;
  return (
    <div className="board-track" aria-hidden="true">
      {Array.from({ length: sceneCount }, (_, index) => (
        <span className="track-tick" key={index} style={{ left: `${(index / denom) * 100}%` }} />
      ))}
      <div className={row.resolved ? 'board-span closed' : 'board-span'} style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }} />
      <span className="track-marker setup" style={{ left: `${left}%` }} />
      <span className={row.resolved ? 'track-marker payoff' : 'track-marker open'} style={{ left: `${(row.endIndex / denom) * 100}%` }} />
    </div>
  );
}

function BoardRow({ row, sceneCount, onFocus }: { row: ClueBoardRow; sceneCount: number; onFocus: (sceneId: string) => void }) {
  const setupChip = row.setupMissing
    ? <em className="route-chip missing">遗失的埋下场景</em>
    : <button className="route-chip" onClick={() => onFocus(row.clue.setupSceneId)}>{sceneLabel(row.setupIndex)} · {row.setupTitle}</button>;
  const payoffChip = !row.clue.payoffSceneId
    ? <em className="route-chip pending">还悬在时间线上</em>
    : row.payoffMissing
      ? <em className="route-chip missing">遗失的回收场景</em>
      : <button className="route-chip" onClick={() => onFocus(row.clue.payoffSceneId)}>{sceneLabel(row.payoffIndex)} · {row.payoffTitle}</button>;

  return (
    <article className={`board-row group-${row.group}${row.aging ? ' aging' : ''}${row.reversed ? ' reversed' : ''}`}>
      <div className="board-row-head">
        <span className="clue-symbol">⌁</span>
        <strong>{row.clue.title}</strong>
        <span className="board-badges">
          {row.setupMissing && <em className="badge badge-dangling">埋下场景已遗失</em>}
          {row.payoffMissing && <em className="badge badge-dangling">回收场景已遗失</em>}
          {row.reversed && <em className="badge badge-reversed">回收早于埋下</em>}
          {row.resolved
            ? <em className="badge badge-closed">已回收</em>
            : row.aging
              ? <em className="badge badge-aging">悬太久 · 快收不回</em>
              : <em className="badge badge-open">未回收</em>}
        </span>
      </div>
      <div className="board-route">
        {setupChip}
        <span className="route-arrow" aria-hidden="true">{row.reversed ? '←' : '→'}</span>
        {payoffChip}
      </div>
      <SpanTrack row={row} sceneCount={sceneCount} />
      <div className="board-meta">
        {row.setupMissing
          ? '无法在当前时间线上定位埋下位置'
          : row.resolved
            ? `跨越 ${row.spanScenes} 个场景 · ${sceneLabel(row.setupIndex)} 埋下，${sceneLabel(row.payoffIndex)} 回收`
            : `已跨越 ${row.spanScenes} 个场景 · 埋下之后又拖了 ${row.distanceFromSetup} 幕${row.aging ? '，建议尽快安排回收' : ''}`}
      </div>
    </article>
  );
}

export function ClueKanban({ viewModel }: ClueKanbanProps) {
  const snapshot = viewModel.snapshot;
  const scenes = viewModel.allScenes;
  const rows = viewModel.clueBoardRows;
  const totalClues = snapshot.story?.clues.length ?? 0;
  const [title, setTitle] = useState('');
  const [setup, setSetup] = useState(scenes[0]?.id ?? '');
  const [payoff, setPayoff] = useState('');
  const filter: ClueFilter = snapshot.clueFilter;

  // 场景可能在别处被增删：表单的默认埋下场景失效时回到时间线第一幕，
  // 但不影响主工作区选中的场景。
  useEffect(() => {
    if (setup && !scenes.some((scene) => scene.id === setup)) setSetup(scenes[0]?.id ?? '');
    if (payoff && !scenes.some((scene) => scene.id === payoff)) setPayoff('');
  }, [scenes, setup, payoff]);

  const submit = () => {
    viewModel.addClue(title, setup, payoff);
    setTitle('');
  };

  return (
    <section className="panel clue-board">
      <div className="panel-heading board-heading">
        <div>
          <span className="eyebrow">THREAD BOARD / 伏笔跨度</span>
          <h2>伏笔看板</h2>
          <p className="board-subtitle">按埋下位置在时间线上的真实顺序排列，跨度随时间线重排即时重算。</p>
        </div>
        <div className="board-tools">
          <div className="filter-toggle" role="group" aria-label="伏笔过滤">
            <button className={filter === 'unresolved' ? 'active' : ''} onClick={() => viewModel.setClueFilter('unresolved')}>只看未回收</button>
            <button className={filter === 'all' ? 'active' : ''} onClick={() => viewModel.setClueFilter('all')}>全部 {totalClues}</button>
          </div>
          <button className="secondary-button" onClick={() => viewModel.setSection('overview')}>← 回到时间线</button>
        </div>
      </div>

      {scenes.length > 0 && (
        <div className="board-ruler">
          <span>第 01 幕</span>
          <span className="ruler-line" />
          <span>{sceneLabel(scenes.length - 1)} · 共 {scenes.length} 幕</span>
        </div>
      )}

      <div className="board-list">
        {rows.map((row) => <BoardRow key={row.clue.id} row={row} sceneCount={scenes.length} onFocus={(sceneId) => viewModel.focusScene(sceneId)} />)}
        {rows.length === 0 && (
          <div className="empty-state">
            {totalClues === 0
              ? '还没有伏笔。在下方登记第一条线索，或先在时间线里铺好场景。'
              : filter === 'unresolved'
                ? '所有伏笔都已回收。切换到「全部」可以回看已沉底的线索。'
                : '时间线上还没有场景，无法计算伏笔跨度。'}
          </div>
        )}
      </div>

      <div className="clue-form board-form">
        <input aria-label="伏笔名称" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder="伏笔名称，例如：罗盘上的刻痕" />
        <select aria-label="埋下场景" value={setup} onChange={(event) => setSetup(event.target.value)}>
          <option value="">埋下场景…</option>
          {scenes.map((scene, index) => <option key={scene.id} value={scene.id}>{sceneLabel(index)} · {scene.title}</option>)}
        </select>
        <select aria-label="回收场景" value={payoff} onChange={(event) => setPayoff(event.target.value)}>
          <option value="">回收场景（稍后）</option>
          {scenes.map((scene, index) => <option key={scene.id} value={scene.id}>{sceneLabel(index)} · {scene.title}</option>)}
        </select>
        <button onClick={submit}>登记伏笔</button>
      </div>
    </section>
  );
}

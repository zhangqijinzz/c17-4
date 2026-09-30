import type { CSSProperties } from 'react';
import type { ClueBoardEntry } from '../models/storyRules';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface ClueBoardProps {
  viewModel: StoryViewModel;
}

const sceneLabel = (index: number | null): string => (index === null ? '—' : String(index + 1).padStart(2, '0'));

function trackStyle(total: number, start: number, span: number): CSSProperties {
  return { '--cells': total, '--start': start, '--span': span } as CSSProperties;
}

function ClueBoardRow({ entry, totalScenes, onFocus }: { entry: ClueBoardEntry; totalScenes: number; onFocus: (sceneId: string) => void }) {
  const { clue, resolved, setupIndex, payoffIndex, spanScenes, setupMissing, payoffMissing, inverted, stale } = entry;
  const classes = ['board-row'];
  if (resolved) classes.push('is-resolved');
  if (stale) classes.push('is-stale');
  if (setupMissing || payoffMissing) classes.push('is-broken');

  return (
    <div className={classes.join(' ')}>
      <div className="board-row-head">
        <strong title={clue.title}>{clue.title}</strong>
        <span className="board-route">
          {setupMissing ? <em className="route-missing">埋下场景已丢失</em> : <>SCENE {sceneLabel(setupIndex)} · {entry.setupScene?.title}</>}
          <b>→</b>
          {!clue.payoffSceneId
            ? <em className="route-open">仍悬着，等待回收</em>
            : payoffMissing
              ? <em className="route-missing">回收场景已丢失</em>
              : <>SCENE {sceneLabel(payoffIndex)} · {entry.payoffScene?.title}</>}
        </span>
        <div className="board-badges">
          {resolved && <em className="board-badge resolved">已回收</em>}
          {!resolved && stale && <em className="board-badge stale">悬置已久</em>}
          {!resolved && !stale && <em className="board-badge open">未回收</em>}
          {inverted && <em className="board-badge inverted">回收早于埋下</em>}
        </div>
      </div>

      <div className="board-track-wrap">
        {setupMissing ? (
          <div className="board-track board-track-lost">
            <span className="lost-line" />
            <span className="lost-hint">指向的场景已不在时间线，伏笔仍保留在看板上</span>
          </div>
        ) : (
          <div className="board-track" style={trackStyle(totalScenes, setupIndex ?? 0, spanScenes ?? 1)}>
            <span className={resolved ? 'board-span resolved' : stale ? 'board-span stale' : 'board-span open'} />
            <button
              type="button"
              className="board-dot setup"
              title={`跳转到埋下场景：${entry.setupScene?.title ?? ''}`}
              onClick={() => onFocus(clue.setupSceneId)}
            />
            {resolved ? (
              <button
                type="button"
                className="board-dot payoff"
                title={`跳转到回收场景：${entry.payoffScene?.title ?? ''}`}
                onClick={() => onFocus(clue.payoffSceneId)}
              />
            ) : payoffMissing ? (
              <span className="board-lost-mark" title="原定回收场景已丢失，伏笔仍未回收">?</span>
            ) : (
              <span className="board-dot open-end" title="这条伏笔还没有回收" />
            )}
          </div>
        )}
      </div>

      <div className="board-span-stat">
        <strong>{spanScenes === null ? '—' : spanScenes}</strong>
        <span>个场景</span>
        {!resolved && setupIndex !== null && <em>已拖 {totalScenes - setupIndex} 幕</em>}
      </div>
    </div>
  );
}

export function ClueBoard({ viewModel }: ClueBoardProps) {
  const story = viewModel.snapshot.story;
  const entries = viewModel.clueBoard;
  const allEntries = viewModel.clueBoardAll;
  const filter = viewModel.clueFilter;
  const totalScenes = story?.scenes.length ?? 0;
  const openCount = allEntries.filter((entry) => !entry.resolved).length;
  const staleCount = allEntries.filter((entry) => entry.stale).length;

  return (
    <section className="panel clue-board-panel">
      <div className="panel-heading clue-board-heading">
        <div>
          <span className="eyebrow">PAYOFF MAP / 伏笔跨度</span>
          <h2>伏笔看板</h2>
        </div>
        <div className="board-toolbar">
          {staleCount > 0 && <span className="board-alert"><i /> {staleCount} 条悬置已久，优先回收</span>}
          <div className="board-filter" role="group" aria-label="伏笔看板筛选">
            <button
              type="button"
              className={filter === 'unresolved' ? 'active' : ''}
              aria-pressed={filter === 'unresolved'}
              onClick={() => viewModel.setClueFilter('unresolved')}
            >未回收 {openCount}</button>
            <button
              type="button"
              className={filter === 'all' ? 'active' : ''}
              aria-pressed={filter === 'all'}
              onClick={() => viewModel.setClueFilter('all')}
            >全部 {allEntries.length}</button>
          </div>
        </div>
      </div>

      {allEntries.length > 0 && (
        <div className="board-row board-scale-row" aria-hidden="true">
          <div className="board-row-head" />
          <div className="board-track-wrap">
            <div className="board-track board-scale-track" style={{ '--cells': Math.max(totalScenes, 1) } as CSSProperties}>
              {Array.from({ length: totalScenes }, (_, index) => (
                <span key={index} className="scale-tick"><i />{String(index + 1).padStart(2, '0')}</span>
              ))}            </div>
          </div>
          <div className="board-span-stat"><span>跨度</span></div>
        </div>
      )}

      <div className="board-rows">
        {entries.map((entry) => (
          <ClueBoardRow
            key={entry.clue.id}
            entry={entry}
            totalScenes={Math.max(totalScenes, 1)}
            onFocus={(sceneId) => viewModel.selectScene(sceneId)}
          />
        ))}
      </div>

      {entries.length === 0 && (
        <div className="empty-state">
          {allEntries.length === 0
            ? '还没有埋下任何伏笔。用下方的表单记录第一条线索。'
            : filter === 'unresolved'
              ? '所有伏笔都已经回收，干干净净。'
              : '时间线还没有场景，先在时间线上创建第一幕。'}
        </div>
      )}
    </section>
  );
}

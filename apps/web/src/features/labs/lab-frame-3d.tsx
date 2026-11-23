'use client';

import { Alert } from '@knj/ui';
import { GameControls, GameLayout, GameWorkspace } from '@knj/ui/game';
import { useViewMode, ViewToggle } from '@knj/ui/game3d';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { SaveStatus } from './use-lab-session';

export interface Scene3DHandlers {
  quality: 'high' | 'low';
  onFps: (fps: number) => void;
  onContextLost: () => void;
}

/**
 * Common frame of a 3D lab: panel with parameters and Run/Pause/Reset, the 3D/2D switch,
 * the scene (3D or the 2D fallback) and what goes under it. Each lab supplies only its parts.
 */
export function LabFrame3D({
  header,
  controls,
  running,
  onRun,
  onPause,
  onReset,
  canSave,
  saveStatus,
  scene3d,
  scene2d,
  below,
  runnable = true,
  children,
}: {
  header: ReactNode;
  controls: ReactNode;
  running: boolean;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  canSave: boolean;
  saveStatus: SaveStatus;
  scene3d: (h: Scene3DHandlers) => ReactNode;
  scene2d: ReactNode;
  below: ReactNode;
  /** Static scenes (equilibrium) have no Run/Pause. */
  runnable?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('labs');
  const view = useViewMode();
  const panel = (
    <GameControls
      running={running}
      onRun={onRun}
      onPause={onPause}
      onReset={onReset}
      runnable={runnable}
      labels={{ run: t('run'), pause: t('pause'), reset: t('reset') }}
    >
      {controls}
      <p className="text-sm text-text-muted" aria-live="polite" data-testid="save-status">
        {!canSave
          ? t('notSaved')
          : saveStatus === 'pending'
            ? t('saving')
            : saveStatus === 'saved'
              ? t('savedNow')
              : saveStatus === 'error'
                ? t('saveFailed')
                : t('questions.saved')}
      </p>
    </GameControls>
  );
  return (
    <GameLayout
      header={header}
      panelTitle={t('panelTitle')}
      showPanelLabel={t('showPanel')}
      hidePanelLabel={t('hidePanel')}
      panel={panel}
      workspace={
        <GameWorkspace
          label={t('workspace')}
          fullscreenLabel={t('fullscreen')}
          exitFullscreenLabel={t('exitFullscreen')}
        >
          <div className="pr-28 sm:pr-36">
            <ViewToggle
              view={view.view}
              canUse3d={view.webgl}
              onChange={view.choose}
              label={t('view.label')}
            />
          </div>
          {view.degraded ? <Alert tone="info">{t('view.degraded')}</Alert> : null}
          {view.ready && view.view === '3d' && view.quality !== '2d'
            ? scene3d({ quality: view.quality, onFps: view.reportFps, onContextLost: view.lost })
            : scene2d}
          {below}
        </GameWorkspace>
      }
    >
      {children}
    </GameLayout>
  );
}

export function SceneLoading() {
  const t = useTranslations('labs.view');
  return (
    <div className="flex h-[clamp(260px,50svh,460px)] items-center justify-center rounded-md bg-surface-muted text-sm text-text-muted">
      {t('loading')}
    </div>
  );
}

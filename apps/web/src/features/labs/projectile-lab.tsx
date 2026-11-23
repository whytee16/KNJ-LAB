'use client';

import {
  createClock,
  flightTime,
  projectile,
  speedSeries,
  THROWN_OBJECTS,
  trajectory,
  type ProjectileParams,
} from '@knj/physics';
import type { Locale } from '@knj/i18n';
import { Alert } from '@knj/ui';
import {
  ChoiceControl,
  GameChart,
  GameControls,
  GameLayout,
  GameReadouts,
  GameWorkspace,
  ParamControl,
} from '@knj/ui/game';
import { useViewMode, ViewToggle } from '@knj/ui/game3d';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ProjectileSide2D } from './projectile-side2d';
import { throwState } from './projectile-geometry';
import { UNIT_KEY } from './units';
import { useLabSession } from './use-lab-session';

type Key = keyof ProjectileParams;
const RANGE_KEYS: Key[] = ['v0', 'angle', 'h0'];

export default function ProjectileLab({
  code,
  locale,
  header,
  defaults,
  initial,
  canSave,
  children,
}: {
  code: string;
  locale: Locale;
  header: ReactNode;
  defaults: ProjectileParams;
  initial: ProjectileParams;
  canSave: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('labs');
  const m = useTranslations('labs.models.projectile');
  const view = useViewMode();
  const [params, setParams] = useState(initial);
  const [tau, setTau] = useState(() => flightTime(initial));
  const [running, setRunning] = useState(false);
  const clock = useRef(createClock());
  const frame = useRef(0);
  const saveStatus = useLabSession(code, params, canSave);

  const nf = useMemo(
    () => new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-RU', { maximumFractionDigits: 2 }),
    [locale],
  );
  const format = useCallback((n: number) => nf.format(Math.abs(n) < 1e-9 ? 0 : n), [nf]);
  const unit = (u: keyof typeof UNIT_KEY) => t(`units.${UNIT_KEY[u]}`);

  const result = projectile.compute(params);
  const T = result.T;
  const now = Math.min(tau, T);
  const { pos, speed } = throwState(params, now);

  const stop = () => {
    cancelAnimationFrame(frame.current);
    setRunning(false);
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const run = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || T === 0) {
      setTau(T);
      return;
    }
    const startTau = tau >= T ? 0 : tau;
    clock.current.reset();
    setTau(startTau);
    setRunning(true);
    let last = performance.now();
    const step = (time: number) => {
      clock.current.advance((time - last) / 1000);
      last = time;
      const next = Math.min(startTau + clock.current.time, T);
      setTau(next);
      if (next >= T) setRunning(false);
      else frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };

  const change = (key: Key, value: number) => {
    stop();
    const next = { ...params, [key]: value };
    setParams(next);
    setTau(flightTime(next));
  };
  const reset = () => {
    stop();
    setParams(defaults);
    setTau(flightTime(defaults));
  };

  const vectorLabels = { v: m('vectorV'), vx: m('vectorVx'), vy: m('vectorVy') };
  const g = projectile.params.g;
  const object = THROWN_OBJECTS[params.object] ?? THROWN_OBJECTS[0];
  const ideal = { ...params, drag: 0 };
  const withDrag = params.drag === 1;
  const panel = (
    <GameControls
      running={running}
      onRun={run}
      onPause={stop}
      onReset={reset}
      labels={{ run: t('run'), pause: t('pause'), reset: t('reset') }}
    >
      {RANGE_KEYS.map((key) => {
        const spec = projectile.params[key];
        return (
          <ParamControl
            key={key}
            label={m(`params.${key}`)}
            symbol={spec.symbol}
            unit={unit(spec.unit)}
            spec={spec}
            value={params[key]}
            onChange={(v) => change(key, v)}
            rangeError={t('range', {
              min: format(spec.min),
              max: format(spec.max),
              unit: unit(spec.unit),
            })}
          />
        );
      })}
      <ChoiceControl
        label={`${m('params.g')}, ${unit(g.unit)}`}
        symbol={g.symbol}
        value={params.g}
        onChange={(v) => change('g', v)}
        options={(g.choices ?? []).map((c) => ({
          value: c.value,
          label: m(`g.${c.key}` as 'g.earth'),
        }))}
      />
      <ChoiceControl
        label={m('params.object')}
        symbol=""
        value={params.object}
        onChange={(v) => change('object', v)}
        options={(projectile.params.object.choices ?? []).map((c) => ({
          value: c.value,
          label: m(`object.${c.key}` as 'object.ball'),
        }))}
      />
      <p className="text-sm text-text-muted" data-testid="object-info">
        {m('objectInfo', {
          m: format(object.m),
          S: format(Math.round(object.S * 10_000)),
          Cd: format(object.Cd),
        })}
      </p>
      <ChoiceControl
        label={m('params.drag')}
        symbol=""
        value={params.drag}
        onChange={(v) => change('drag', v)}
        options={(projectile.params.drag.choices ?? []).map((c) => ({
          value: c.value,
          label: m(`drag.${c.key}` as 'drag.off'),
        }))}
      />
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

  const scene =
    view.ready && view.view === '3d' && view.quality !== '2d' ? (
      <ProjectileScene3D
        params={params}
        tau={now}
        quality={view.quality}
        label={m('scene3d')}
        resetLabel={t('view.resetCamera')}
        format={format}
        unit={unit('m')}
        vectorLabels={vectorLabels}
        onFps={view.reportFps}
        onContextLost={view.lost}
      />
    ) : (
      <ProjectileSide2D
        params={params}
        tau={now}
        label={m('scene2d')}
        format={format}
        unit={unit('m')}
        vectorLabels={vectorLabels}
      />
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
          {scene}
          <GameReadouts
            title={t('readouts')}
            items={[
              {
                id: 'tau',
                label: m('readouts.tau'),
                symbol: 't',
                value: format(now),
                unit: unit('s'),
              },
              {
                id: 'x',
                label: m('readouts.x'),
                symbol: 'x',
                value: format(pos.x),
                unit: unit('m'),
              },
              {
                id: 'y',
                label: m('readouts.y'),
                symbol: 'y',
                value: format(pos.y),
                unit: unit('m'),
              },
              {
                id: 'v',
                label: m('readouts.v'),
                symbol: '|v|',
                value: format(speed),
                unit: unit('m/s'),
              },
            ]}
          />
          <GameReadouts
            title={m('resultsTitle')}
            items={(withDrag
              ? (['T', 'L', 'L0', 'H', 'vEnd'] as const)
              : (['T', 'L', 'H', 'vEnd'] as const)
            ).map((k) => ({
              id: k,
              label: m(`results.${k}`),
              symbol: projectile.results[k].symbol,
              value: format(result[k]),
              unit: unit(projectile.results[k].unit),
            }))}
          />
          {withDrag ? (
            <p className="text-sm font-medium" role="status" data-testid="drag-note">
              {m('dragNote', {
                d: format(result.L0 - result.L),
                pct: format(Math.round((100 * (result.L0 - result.L)) / Math.max(result.L0, 1e-9))),
              })}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <GameChart
              title={m('trajectoryTitle')}
              xLabel={`x, ${unit('m')}`}
              yLabel={`y, ${unit('m')}`}
              series={trajectory(params)}
              xMax={Math.max(result.L, withDrag ? result.L0 : 0, 1)}
              yMax={Math.max(result.H, withDrag ? projectile.compute(ideal).H : 0, 1)}
              marker={pos}
              label={withDrag ? m('withAir') : undefined}
              more={
                withDrag
                  ? [{ points: trajectory(ideal), tone: 'muted', label: m('withoutAir') }]
                  : undefined
              }
              description={m(withDrag ? 'trajectoryDragDescription' : 'trajectoryDescription', {
                L: format(result.L),
                H: format(result.H),
              })}
            />
            <GameChart
              title={m('speedTitle')}
              xLabel={`t, ${unit('s')}`}
              yLabel={`|v|, ${unit('m/s')}`}
              series={speedSeries(params)}
              xMax={Math.max(T, 0.5)}
              yMax={Math.max(result.vEnd, params.v0, 1)}
              marker={{ x: now, y: speed }}
              description={m('speedDescription', { v: format(result.vEnd) })}
            />
          </div>
        </GameWorkspace>
      }
    >
      {children}
    </GameLayout>
  );
}

function SceneLoading() {
  const t = useTranslations('labs.view');
  return (
    <div className="flex h-[clamp(260px,50svh,460px)] items-center justify-center rounded-md bg-surface-muted text-sm text-text-muted">
      {t('loading')}
    </div>
  );
}

// three.js is loaded only when the 3D view is shown (never on the server).
const ProjectileScene3D = dynamic(() => import('./projectile-scene3d'), {
  ssr: false,
  loading: SceneLoading,
});

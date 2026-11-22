'use client';

import { accelerationByAngle, inclinedPlane, type InclinedPlaneParams } from '@knj/physics';
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
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { inclineFrame } from './incline-geometry';
import { InclineSide2D } from './incline-side2d';
import { unitText } from './units';
import { useLabSession } from './use-lab-session';
import { useModelTime } from './use-model-time';

type Key = keyof InclinedPlaneParams;
const RANGE_KEYS = ['angle', 'mu', 'm', 'L'] as const;
const RESULT_KEYS = ['Fg', 'Fpar', 'N', 'Ffr', 'a', 't', 'v', 'critical'] as const;

export default function InclineLab({
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
  defaults: InclinedPlaneParams;
  initial: InclinedPlaneParams;
  canSave: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('labs');
  const m = useTranslations('labs.models.inclinedPlane');
  const view = useViewMode();
  const [params, setParams] = useState(initial);
  const result = inclinedPlane.compute(params);
  const time = useModelTime(result.t);
  const saveStatus = useLabSession(code, params, canSave);

  const nf = useMemo(
    () => new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-RU', { maximumFractionDigits: 2 }),
    [locale],
  );
  const format = useCallback((n: number) => nf.format(Math.abs(n) < 1e-9 ? 0 : n), [nf]);
  const unit = (u: Parameters<typeof unitText>[1]) => unitText(t, u);

  const frame = inclineFrame(params, time.tau);
  const change = (key: Key, value: number) => {
    const next = { ...params, [key]: value };
    setParams(next);
    time.restart(inclinedPlane.compute(next).t);
  };
  const reset = () => {
    setParams(defaults);
    time.restart(inclinedPlane.compute(defaults).t);
  };

  const forceLabels = {
    mg: m('forces.mg'),
    N: m('forces.N'),
    Ffr: m('forces.Ffr'),
    ma: m('forces.ma'),
  };
  const angleLabel = `α = ${format(params.angle)}°`;
  const g = inclinedPlane.params.g;
  const panel = (
    <GameControls
      running={time.running}
      onRun={time.run}
      onPause={time.stop}
      onReset={reset}
      labels={{ run: t('run'), pause: t('pause'), reset: t('reset') }}
    >
      {RANGE_KEYS.map((key) => {
        const spec = inclinedPlane.params[key];
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
      <InclineScene3D
        params={params}
        tau={time.tau}
        quality={view.quality}
        label={m('scene3d')}
        resetLabel={t('view.resetCamera')}
        angleLabel={angleLabel}
        forceLabels={forceLabels}
        onFps={view.reportFps}
        onContextLost={view.lost}
      />
    ) : (
      <InclineSide2D
        params={params}
        tau={time.tau}
        label={m('scene2d')}
        angleLabel={angleLabel}
        forceLabels={forceLabels}
      />
    );

  const vMax = Math.max(result.v, 0.5);
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
          <p
            role="status"
            data-testid="motion-state"
            className={
              result.moves ? 'text-sm font-medium text-success' : 'text-sm font-medium text-text'
            }
          >
            {result.moves
              ? m('slides', { a: format(result.a) })
              : m('rests', { critical: format(result.critical) })}
          </p>
          <GameReadouts
            title={t('readouts')}
            items={[
              {
                id: 'tau',
                label: m('readouts.tau'),
                symbol: 't',
                value: format(time.tau),
                unit: unit('s'),
              },
              {
                id: 's',
                label: m('readouts.s'),
                symbol: 's',
                value: format(frame.s),
                unit: unit('m'),
              },
              {
                id: 'speed',
                label: m('readouts.v'),
                symbol: 'v',
                value: format(frame.v),
                unit: unit('m/s'),
              },
            ]}
          />
          <GameReadouts
            title={m('resultsTitle')}
            items={RESULT_KEYS.map((k) => ({
              id: k,
              label: m(`results.${k}`),
              symbol: inclinedPlane.results[k].symbol,
              value: format(result[k]),
              unit: unit(inclinedPlane.results[k].unit),
            }))}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <GameChart
              title={m('accelerationTitle')}
              xLabel={`α, ${unit('deg')}`}
              yLabel={`a, ${unit('m/s2')}`}
              series={accelerationByAngle(params)}
              xMax={inclinedPlane.params.angle.max}
              yMax={Math.max(params.g * 0.9, 0.5)}
              marker={{ x: params.angle, y: result.a }}
              description={m('accelerationDescription', { critical: format(result.critical) })}
            />
            <GameChart
              title={m('speedTitle')}
              xLabel={`t, ${unit('s')}`}
              yLabel={`v, ${unit('m/s')}`}
              series={[
                { x: 0, y: 0 },
                { x: Math.max(result.t, 0.5), y: result.v },
              ]}
              xMax={Math.max(result.t, 0.5)}
              yMax={vMax}
              marker={{ x: time.tau, y: frame.v }}
              description={m('speedDescription', { v: format(result.v), t: format(result.t) })}
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

const InclineScene3D = dynamic(() => import('./incline-scene3d'), {
  ssr: false,
  loading: SceneLoading,
});

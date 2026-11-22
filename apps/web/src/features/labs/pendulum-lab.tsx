'use client';

import {
  pendulum,
  pendulumAt,
  pendulumEnergy,
  simulatePendulum,
  type PendulumParams,
} from '@knj/physics';
import type { Locale } from '@knj/i18n';
import { ChoiceControl, GameChart, GameReadouts, ParamControl } from '@knj/ui/game';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { LabFrame3D, SceneLoading } from './lab-frame-3d';
import { PendulumSide2D } from './pendulum-views';
import { unitText } from './units';
import { useLabSession } from './use-lab-session';
import { useModelTime } from './use-model-time';

const RANGE_KEYS = ['l', 'theta0', 'm'] as const;
const RESULT_KEYS = ['T0', 'T', 'deviation', 'E', 'vMax', 'nu'] as const;
const PERIODS = 10;

const PendulumScene3D = dynamic(() => import('./pendulum-scene3d'), {
  ssr: false,
  loading: SceneLoading,
});

export default function PendulumLab({
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
  defaults: PendulumParams;
  initial: PendulumParams;
  canSave: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('labs');
  const m = useTranslations('labs.models.mathPendulum');
  const [params, setParams] = useState(initial);
  const result = pendulum.compute(params);
  const duration = PERIODS * result.T;
  const time = useModelTime(duration, 'start');
  const saveStatus = useLabSession(code, params, canSave);
  const samples = useMemo(() => simulatePendulum(params, duration), [params, duration]);

  const nf = useMemo(
    () => new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-RU', { maximumFractionDigits: 3 }),
    [locale],
  );
  const format = useCallback((n: number) => nf.format(Math.abs(n) < 1e-9 ? 0 : n), [nf]);
  const unit = (u: Parameters<typeof unitText>[1]) => unitText(t, u);

  const state = pendulumAt(samples, time.tau);
  const energy = pendulumEnergy(params, state);
  const deg = (state.theta * 180) / Math.PI;

  const change = (key: keyof PendulumParams, value: number) => {
    const next = { ...params, [key]: value };
    setParams(next);
    time.restart(PERIODS * pendulum.compute(next).T);
  };
  const reset = () => {
    setParams(defaults);
    time.restart(PERIODS * pendulum.compute(defaults).T);
  };

  // Chart data: the first three periods, thinned to ~240 points.
  const window3 = samples.filter((s) => s.t <= 3 * result.T);
  const step = Math.max(1, Math.floor(window3.length / 240));
  const thin = window3.filter((_, i) => i % step === 0);
  const g = pendulum.params.g;

  const controls = (
    <>
      {RANGE_KEYS.map((key) => {
        const spec = pendulum.params[key];
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
    </>
  );

  const below = (
    <>
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
            id: 'theta',
            label: m('readouts.theta'),
            symbol: 'θ',
            value: format(deg),
            unit: unit('deg'),
          },
          {
            id: 'speed',
            label: m('readouts.v'),
            symbol: 'v',
            value: format(Math.abs(energy.v)),
            unit: unit('m/s'),
          },
          {
            id: 'Ek',
            label: m('readouts.Ek'),
            symbol: 'Eк',
            value: format(energy.Ek),
            unit: unit('J'),
          },
          {
            id: 'Ep',
            label: m('readouts.Ep'),
            symbol: 'Eп',
            value: format(energy.Ep),
            unit: unit('J'),
          },
        ]}
      />
      <GameReadouts
        title={m('resultsTitle')}
        items={RESULT_KEYS.map((k) => ({
          id: k,
          label: m(`results.${k}`),
          symbol: pendulum.results[k].symbol,
          value: format(result[k]),
          unit: unit(pendulum.results[k].unit),
        }))}
      />
      <p className="text-sm text-text-muted" data-testid="period-note">
        {m('periodNote', {
          T0: format(result.T0),
          T: format(result.T),
          d: format(result.deviation),
        })}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <GameChart
          title={m('angleTitle')}
          xLabel={`t, ${unit('s')}`}
          yLabel={`θ, ${unit('deg')}`}
          series={thin.map((s) => ({ x: s.t, y: (s.theta * 180) / Math.PI }))}
          xMax={3 * result.T}
          yMax={params.theta0}
          yMin={-params.theta0}
          marker={time.tau <= 3 * result.T ? { x: time.tau, y: deg } : undefined}
          description={m('angleDescription', { T: format(result.T) })}
        />
        <GameChart
          title={m('energyTitle')}
          xLabel={`t, ${unit('s')}`}
          yLabel={`E, ${unit('J')}`}
          label={m('energyTotal')}
          series={thin.map((s) => ({ x: s.t, y: result.E }))}
          more={[
            {
              points: thin.map((s) => ({ x: s.t, y: pendulumEnergy(params, s).Ek })),
              tone: 'success',
              label: m('energyKinetic'),
            },
            {
              points: thin.map((s) => ({ x: s.t, y: pendulumEnergy(params, s).Ep })),
              tone: 'info',
              label: m('energyPotential'),
            },
          ]}
          xMax={3 * result.T}
          yMax={Math.max(result.E, 1e-6) * 1.05}
          description={m('energyDescription', { E: format(result.E) })}
        />
      </div>
    </>
  );

  return (
    <LabFrame3D
      header={header}
      controls={controls}
      running={time.running}
      onRun={time.run}
      onPause={time.stop}
      onReset={reset}
      canSave={canSave}
      saveStatus={saveStatus}
      scene3d={(h) => (
        <PendulumScene3D
          {...h}
          params={params}
          state={state}
          label={m('scene3d')}
          resetLabel={t('view.resetCamera')}
          vLabel={m('vectorV')}
        />
      )}
      scene2d={
        <PendulumSide2D
          params={params}
          state={state}
          label={m('scene2d')}
          angleLabel={`θ = ${format(deg)}°`}
        />
      }
      below={below}
    >
      {children}
    </LabFrame3D>
  );
}

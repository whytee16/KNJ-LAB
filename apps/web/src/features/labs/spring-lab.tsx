'use client';

import { springAt, springPendulum, type SpringParams } from '@knj/physics';
import type { Locale } from '@knj/i18n';
import { GameChart, GameReadouts, ParamControl } from '@knj/ui/game';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { LabFrame3D, SceneLoading } from './lab-frame-3d';
import { SpringSide2D } from './spring-views';
import { unitText } from './units';
import { useLabSession } from './use-lab-session';
import { useModelTime } from './use-model-time';

const RANGE_KEYS = ['m', 'k', 'A'] as const;
const RESULT_KEYS = ['T', 'omega', 'nu', 'E', 'vMax', 'aMax'] as const;
const PERIODS = 10;

const SpringScene3D = dynamic(() => import('./spring-scene3d'), {
  ssr: false,
  loading: SceneLoading,
});

export default function SpringLab({
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
  defaults: SpringParams;
  initial: SpringParams;
  canSave: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('labs');
  const m = useTranslations('labs.models.springPendulum');
  const [params, setParams] = useState(initial);
  const result = springPendulum.compute(params);
  const time = useModelTime(PERIODS * result.T, 'start');
  const saveStatus = useLabSession(code, params, canSave);

  const nf = useMemo(
    () => new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-RU', { maximumFractionDigits: 3 }),
    [locale],
  );
  const format = useCallback((n: number) => nf.format(Math.abs(n) < 1e-9 ? 0 : n), [nf]);
  const unit = (u: Parameters<typeof unitText>[1]) => unitText(t, u);

  const now = springAt(params, time.tau);
  const change = (key: keyof SpringParams, value: number) => {
    const next = { ...params, [key]: value };
    setParams(next);
    time.restart(PERIODS * springPendulum.compute(next).T);
  };
  const reset = () => {
    setParams(defaults);
    time.restart(PERIODS * springPendulum.compute(defaults).T);
  };

  const times = Array.from({ length: 241 }, (_, i) => (3 * result.T * i) / 240);
  const states = times.map((tt) => ({ t: tt, ...springAt(params, tt) }));

  const controls = RANGE_KEYS.map((key) => {
    const spec = springPendulum.params[key];
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
  });

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
          { id: 'x', label: m('readouts.x'), symbol: 'x', value: format(now.x), unit: unit('m') },
          {
            id: 'speed',
            label: m('readouts.v'),
            symbol: 'v',
            value: format(now.v),
            unit: unit('m/s'),
          },
          { id: 'F', label: m('readouts.F'), symbol: 'F', value: format(now.F), unit: unit('N') },
          {
            id: 'Ek',
            label: m('readouts.Ek'),
            symbol: 'Eк',
            value: format(now.Ek),
            unit: unit('J'),
          },
          {
            id: 'Ep',
            label: m('readouts.Ep'),
            symbol: 'Eп',
            value: format(now.Ep),
            unit: unit('J'),
          },
        ]}
      />
      <GameReadouts
        title={m('resultsTitle')}
        items={RESULT_KEYS.map((k) => ({
          id: k,
          label: m(`results.${k}`),
          symbol: springPendulum.results[k].symbol,
          value: format(result[k]),
          unit: unit(springPendulum.results[k].unit),
        }))}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <GameChart
          title={m('xTitle')}
          xLabel={`t, ${unit('s')}`}
          yLabel={`x, ${unit('m')}`}
          series={states.map((s) => ({ x: s.t, y: s.x }))}
          xMax={3 * result.T}
          yMax={params.A}
          yMin={-params.A}
          marker={time.tau <= 3 * result.T ? { x: time.tau, y: now.x } : undefined}
          description={m('xDescription', { T: format(result.T), A: format(params.A) })}
        />
        <GameChart
          title={m('energyTitle')}
          xLabel={`t, ${unit('s')}`}
          yLabel={`E, ${unit('J')}`}
          label={m('energyTotal')}
          series={states.map((s) => ({ x: s.t, y: result.E }))}
          more={[
            {
              points: states.map((s) => ({ x: s.t, y: s.Ek })),
              tone: 'success',
              label: m('energyKinetic'),
            },
            {
              points: states.map((s) => ({ x: s.t, y: s.Ep })),
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

  const labels = { v: m('vectorV'), F: m('vectorF'), eq: m('equilibrium') };
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
        <SpringScene3D
          {...h}
          params={params}
          x={now.x}
          v={now.v}
          F={now.F}
          label={m('scene3d')}
          resetLabel={t('view.resetCamera')}
          labels={labels}
        />
      )}
      scene2d={<SpringSide2D params={params} x={now.x} label={m('scene2d')} eqLabel={labels.eq} />}
      below={below}
    >
      {children}
    </LabFrame3D>
  );
}

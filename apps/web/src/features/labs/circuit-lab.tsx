'use client';

import { circuit, iv, PARALLEL, type CircuitParams } from '@knj/physics';
import type { Locale } from '@knj/i18n';
import { ChoiceControl, GameChart, GameReadouts, ParamControl } from '@knj/ui/game';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { CircuitSide2D } from './circuit-side2d';
import { LabFrame3D, SceneLoading } from './lab-frame-3d';
import { unitText } from './units';
import { useLabSession } from './use-lab-session';
import { useModelTime } from './use-model-time';

const RANGE_KEYS = ['emf', 'r', 'R1', 'R2'] as const;
const RESULT_KEYS = ['R', 'I', 'U', 'P1', 'P2', 'P'] as const;
/** The charges keep flowing while the switch is closed (an hour of model time). */
const FLOW_SECONDS = 3600;

const CircuitScene3D = dynamic(() => import('./circuit-scene3d'), {
  ssr: false,
  loading: SceneLoading,
});

export default function CircuitLab({
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
  defaults: CircuitParams;
  initial: CircuitParams;
  canSave: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('labs');
  const m = useTranslations('labs.models.circuit');
  const [params, setParams] = useState(initial);
  const result = circuit.compute(params);
  // "Run" closes the switch, "Pause" opens it: the meters show the current only while it flows.
  const time = useModelTime(FLOW_SECONDS, 'start');
  const closed = time.running;
  const saveStatus = useLabSession(code, params, canSave);

  const nf = useMemo(
    () => new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-RU', { maximumFractionDigits: 3 }),
    [locale],
  );
  const format = useCallback((n: number) => nf.format(Math.abs(n) < 1e-9 ? 0 : n), [nf]);
  const unit = (u: Parameters<typeof unitText>[1]) => unitText(t, u);

  const live = (v: number) => (closed ? v : 0);
  const change = (key: keyof CircuitParams, value: number) => {
    setParams({ ...params, [key]: value });
  };
  const reset = () => {
    setParams(defaults);
    time.restart(FLOW_SECONDS);
  };

  const parallel = params.mode === PARALLEL;
  const labels = {
    ammeter: `${format(live(result.I))} ${unit('A')}`,
    voltmeter: `${format(live(result.U1))} ${unit('V')}`,
    R1: `R₁ = ${format(params.R1)} ${unit('Ohm')}`,
    R2: `R₂ = ${format(params.R2)} ${unit('Ohm')}`,
    source: `ε = ${format(params.emf)} ${unit('V')}`,
  };
  const mode = circuit.params.mode;
  const Umax = params.emf;

  const controls = (
    <>
      <ChoiceControl
        label={m('params.mode')}
        symbol=""
        value={params.mode}
        onChange={(v) => change('mode', v)}
        options={(mode.choices ?? []).map((c) => ({
          value: c.value,
          label: m(`modes.${c.key}` as 'modes.series'),
        }))}
      />
      {RANGE_KEYS.map((key) => {
        const spec = circuit.params[key];
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
    </>
  );

  const below = (
    <>
      <p role="status" data-testid="switch-state" className="text-sm font-medium">
        {closed ? m('closed') : m('open')}
      </p>
      <GameReadouts
        title={t('readouts')}
        items={[
          {
            id: 'I',
            label: m('readouts.I'),
            symbol: 'I',
            value: format(live(result.I)),
            unit: unit('A'),
          },
          {
            id: 'I1',
            label: m('readouts.I1'),
            symbol: 'I₁',
            value: format(live(result.I1)),
            unit: unit('A'),
          },
          {
            id: 'I2',
            label: m('readouts.I2'),
            symbol: 'I₂',
            value: format(live(result.I2)),
            unit: unit('A'),
          },
          {
            id: 'U1',
            label: m('readouts.U1'),
            symbol: 'U₁',
            value: format(live(result.U1)),
            unit: unit('V'),
          },
          {
            id: 'U2',
            label: m('readouts.U2'),
            symbol: 'U₂',
            value: format(live(result.U2)),
            unit: unit('V'),
          },
          {
            id: 'U',
            label: m('readouts.U'),
            symbol: 'U',
            value: format(closed ? result.U : params.emf),
            unit: unit('V'),
          },
        ]}
      />
      <GameReadouts
        title={m('resultsTitle')}
        items={RESULT_KEYS.map((k) => ({
          id: `calc-${k}`,
          label: m(`results.${k}`),
          symbol: circuit.results[k].symbol,
          value: format(result[k]),
          unit: unit(circuit.results[k].unit),
        }))}
      />
      <p className="text-sm text-text-muted" data-testid="rule">
        {parallel
          ? m('ruleParallel', { I1: format(result.I1), I2: format(result.I2), I: format(result.I) })
          : m('ruleSeries', { U1: format(result.U1), U2: format(result.U2), U: format(result.U) })}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <GameChart
          title={m('ivTitle')}
          xLabel={`U, ${unit('V')}`}
          yLabel={`I, ${unit('A')}`}
          label={m('ivTotal')}
          series={iv(result.R, Umax)}
          more={[
            { points: iv(params.R1, Umax), tone: 'success', label: m('ivR1') },
            { points: iv(params.R2, Umax), tone: 'info', label: m('ivR2') },
          ]}
          xMax={Umax}
          yMax={Math.max(Umax / Math.min(result.R, params.R1, params.R2), 0.01)}
          marker={{ x: result.U, y: result.U / result.R }}
          description={m('ivDescription')}
        />
        <GameChart
          title={m('powerTitle')}
          xLabel={`R₁, ${unit('Ohm')}`}
          yLabel={`P₁, ${unit('W')}`}
          series={Array.from({ length: 41 }, (_, i) => {
            const R1 = 1 + (99 * i) / 40;
            return { x: R1, y: circuit.compute({ ...params, R1 }).P1 };
          })}
          xMax={100}
          yMax={Math.max(
            ...Array.from(
              { length: 41 },
              (_, i) => circuit.compute({ ...params, R1: 1 + (99 * i) / 40 }).P1,
            ),
            0.01,
          )}
          marker={{ x: params.R1, y: result.P1 }}
          description={m('powerDescription')}
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
        <CircuitScene3D
          {...h}
          params={params}
          tau={time.tau}
          closed={closed}
          label={m('scene3d')}
          resetLabel={t('view.resetCamera')}
          labels={labels}
        />
      )}
      scene2d={
        <CircuitSide2D
          params={params}
          tau={time.tau}
          closed={closed}
          label={m('scene2d')}
          labels={labels}
        />
      }
      below={below}
    >
      {children}
    </LabFrame3D>
  );
}

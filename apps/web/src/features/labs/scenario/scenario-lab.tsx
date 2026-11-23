'use client';

import { isShown, scenarioFor, type ForceVec, type Scenario, type Values } from '@knj/physics';
import type { Locale } from '@knj/i18n';
import { CheckboxField } from '@knj/ui';
import { ChoiceControl, GameChart, GameReadouts, ParamControl } from '@knj/ui/game';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { LabFrame3D, SceneLoading } from '../lab-frame-3d';
import { camelCode, unitText } from '../units';
import { useLabSession } from '../use-lab-session';
import { useModelTime } from '../use-model-time';
import { liftFloor } from './layout';
import type { ScenarioSceneLabels } from './scene3d';
import { ScenarioSide2D } from './side2d';

const ScenarioScene3D = dynamic(() => import('./scene3d'), { ssr: false, loading: SceneLoading });

const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

/**
 * Any mechanics scenario (ADR-0010): controls, readouts, status, charts and the 3D/2D scene are
 * built from the scenario description. Texts come from labs.models.<code>.* messages.
 */
export default function ScenarioLab({
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
  defaults: Values;
  initial: Values;
  canSave: boolean;
  children?: ReactNode;
}) {
  const scenario = scenarioFor(code) as Scenario;
  const t = useTranslations('labs');
  const all = useTranslations();
  const key = `labs.models.${camelCode(code)}`;
  const m = (k: string, values?: Record<string, string>) =>
    all(`${key}.${k}` as 'labs.title', values as never);
  const [params, setParams] = useState(initial);
  const [showForces, setShowForces] = useState(true);
  const duration = scenario.duration(params);
  const time = useModelTime(duration, 'start');
  const saveStatus = useLabSession(code, params, canSave);

  const nf = useMemo(
    () => new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-RU', { maximumFractionDigits: 2 }),
    [locale],
  );
  const format = useCallback((n: number) => nf.format(Math.abs(n) < 1e-9 ? 0 : n), [nf]);
  const unit = (u: Parameters<typeof unitText>[1]) => unitText(t, u);

  const results = scenario.compute(params);
  const state = scenario.state(params, time.tau);
  const forces = scenario.forces(params);
  const status = scenario.status(params);
  const charts = scenario.charts(params, time.tau);
  const forceLabel = (f: { kind: ForceVec['kind']; index?: number }) =>
    `${t(`forces.${f.kind}`)}${f.index !== undefined ? (SUB[f.index] ?? '') : ''}`;

  const change = (k: string, value: number) => {
    const next = { ...params, [k]: value };
    setParams(next);
    time.restart(scenario.duration(next));
  };
  const reset = () => {
    setParams(defaults);
    time.restart(scenario.duration(defaults));
  };

  const controls = (
    <>
      {Object.entries(scenario.params)
        .filter(([, spec]) => isShown(spec, params))
        .map(([k, spec]) =>
          spec.choices ? (
            <ChoiceControl
              key={k}
              label={m(`params.${k}`)}
              symbol={spec.symbol}
              value={params[k]!}
              onChange={(v) => change(k, v)}
              options={spec.choices.map((c) => ({
                value: c.value,
                label: m(`choices.${k}.${c.key}`),
              }))}
            />
          ) : (
            <ParamControl
              key={k}
              label={m(`params.${k}`)}
              symbol={spec.symbol}
              unit={unit(spec.unit)}
              spec={spec}
              value={params[k]!}
              onChange={(v) => change(k, v)}
              rangeError={t('range', {
                min: format(spec.min),
                max: format(spec.max),
                unit: unit(spec.unit),
              })}
            />
          ),
        )}
      <CheckboxField
        label={t('showForces')}
        checked={showForces}
        onChange={(e) => setShowForces(e.target.checked)}
      />
    </>
  );

  const reading =
    scenario.layout === 'elevator' ? `${format(results.P ?? 0)} ${unit('N')}` : undefined;
  // A torn link changes the motion only where bodies hang on it (the lamp is a strength check).
  const broken =
    status.key === 'breaks' && (scenario.layout === 'table-pulley' || scenario.layout === 'atwood');
  const motion = { fall: state.fall ?? 0, v: state.live.v ?? 0, broken };
  const labels: ScenarioSceneLabels = {};
  if (scenario.layout === 'elevator') {
    const v = state.live.v ?? 0;
    const a = params.a ?? 0;
    const moving = Math.abs(v) > 1e-6;
    const dir = moving ? Math.sign(v) : Math.sign(a);
    const key =
      !moving && Math.abs(a) < 1e-9
        ? 'stands'
        : Math.abs(a) < 1e-9
          ? dir > 0
            ? 'upUniform'
            : 'downUniform'
          : !moving
            ? dir > 0
              ? 'startsUp'
              : 'startsDown'
            : Math.sign(a) === dir
              ? dir > 0
                ? 'upSpeeding'
                : 'downSpeeding'
              : dir > 0
                ? 'upBraking'
                : 'downBraking';
    labels.motion = m(`motion.${key}`);
    labels.floor = m('floor', { n: String(liftFloor(state.live.h ?? 0)) });
    labels.v = 'v';
    labels.a = 'a';
  }
  if ((params.link ?? 0) === 2 && !broken && results.x !== undefined)
    labels.extension = `x = ${format(results.x)} ${unit('cm')}`;
  const statusValues = Object.fromEntries(
    Object.entries(status.values).map(([k, v]) => [k, v === undefined ? '' : format(v)]),
  );
  const liveEntries = Object.entries(scenario.liveSpecs);
  const below = (
    <>
      <p role="status" data-testid="scenario-status" className="text-sm font-medium">
        {m(`status.${status.key}`, statusValues)}
      </p>
      {labels.motion ? (
        <p className="text-sm font-semibold" data-testid="lift-state">
          {`${labels.motion} · ${labels.floor}`}
        </p>
      ) : null}
      {liveEntries.length ? (
        <GameReadouts
          title={t('readouts')}
          items={liveEntries.map(([k, spec]) => ({
            id: `live-${k}`,
            label: m(`live.${k}`),
            symbol: spec.symbol,
            value: format(state.live[k] ?? 0),
            unit: unit(spec.unit),
          }))}
        />
      ) : null}
      <GameReadouts
        title={m('resultsTitle')}
        items={Object.entries(scenario.results)
          .filter(([, spec]) => isShown(spec, params))
          .map(([k, spec]) => ({
            id: k,
            label: m(`results.${k}`),
            symbol: spec.symbol,
            value: format(results[k] ?? 0),
            unit: unit(spec.unit),
          }))}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {charts.map((c) => (
          <GameChart
            key={c.id}
            title={m(`charts.${c.id}.title`)}
            xLabel={`${c.x.symbol}${unit(c.x.unit) ? `, ${unit(c.x.unit)}` : ''}`}
            yLabel={`${c.y.symbol}${unit(c.y.unit) ? `, ${unit(c.y.unit)}` : ''}`}
            series={c.series}
            xMax={c.xMax}
            yMax={c.yMax}
            marker={c.marker}
            description={m(`charts.${c.id}.description`)}
          />
        ))}
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
      runnable={duration > 0}
      canSave={canSave}
      saveStatus={saveStatus}
      scene3d={(h) => (
        <ScenarioScene3D
          {...h}
          layout={scenario.layout}
          params={params}
          s={state.s}
          motion={motion}
          forces={forces}
          showForces={showForces}
          forceLabel={forceLabel}
          reading={reading}
          labels={labels}
          label={m('scene')}
          resetLabel={t('view.resetCamera')}
        />
      )}
      scene2d={
        <ScenarioSide2D
          layout={scenario.layout}
          params={params}
          s={state.s}
          motion={motion}
          forces={forces}
          showForces={showForces}
          forceLabel={forceLabel}
          reading={reading}
          labels={labels}
          label={m('scene')}
        />
      }
      below={below}
    >
      {children}
    </LabFrame3D>
  );
}

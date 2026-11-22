'use client';

import {
  createClock,
  pathSeries,
  positionAt,
  uniformMotion,
  type UniformMotionParams,
} from '@knj/physics';
import type { Locale } from '@knj/i18n';
import {
  GameChart,
  GameControls,
  GameLayout,
  GameReadouts,
  GameWorkspace,
  ParamControl,
  ticks,
} from '@knj/ui/game';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLabSession } from './use-lab-session';

const UNIT_KEY = { m: 'm', s: 's', 'm/s': 'mps' } as const;
type ParamKey = keyof UniformMotionParams;
const PARAM_KEYS: ParamKey[] = ['v', 't', 'x0'];

/** Track drawing: no physics here — positions come from the model. */
function Track({
  x0,
  x,
  xEnd,
  scaleMax,
  label,
  unit,
  format,
}: {
  x0: number;
  x: number;
  xEnd: number;
  scaleMax: number;
  label: string;
  unit: string;
  format: (n: number) => string;
}) {
  const W = 640;
  const L = 28;
  const R = 612;
  const marks = ticks(scaleMax, 6);
  const top = marks[marks.length - 1] || 1;
  const px = (m: number) => L + (m / top) * (R - L);
  return (
    <svg viewBox={`0 0 ${W} 132`} role="img" aria-label={label} className="w-full">
      <rect x={L - 8} y={70} width={R - L + 16} height={14} rx={7} className="fill-surface-muted" />
      <line
        x1={px(x0)}
        x2={px(xEnd)}
        y1={77}
        y2={77}
        className="stroke-accent/40"
        strokeWidth={14}
        strokeLinecap="round"
      />
      {marks.map((m) => (
        <g key={m}>
          <line
            x1={px(m)}
            x2={px(m)}
            y1={88}
            y2={96}
            className="stroke-text-muted"
            strokeWidth={1}
          />
          <text x={px(m)} y={112} textAnchor="middle" className="fill-text-muted text-[11px]">
            {format(m)}
          </text>
        </g>
      ))}
      <text x={R} y={128} textAnchor="end" className="fill-text-muted text-[11px]">
        {`x, ${unit}`}
      </text>
      <g>
        <line
          x1={px(x0)}
          x2={px(x0)}
          y1={30}
          y2={70}
          className="stroke-text-muted"
          strokeDasharray="3 3"
        />
        <text x={px(x0)} y={24} textAnchor="middle" className="fill-text-muted text-[11px]">
          {'x₀'}
        </text>
        <line
          x1={px(xEnd)}
          x2={px(xEnd)}
          y1={30}
          y2={70}
          className="stroke-text-muted"
          strokeDasharray="3 3"
        />
        <text x={px(xEnd)} y={24} textAnchor="middle" className="fill-text-muted text-[11px]">
          {'x'}
        </text>
      </g>
      <g transform={`translate(${px(x)} 0)`}>
        <rect x={-14} y={48} width={28} height={18} rx={5} className="fill-accent" />
        <circle cx={-7} cy={68} r={4} className="fill-text" />
        <circle cx={7} cy={68} r={4} className="fill-text" />
      </g>
    </svg>
  );
}

/** Reference lab: uniform motion S = v·t (GAME_TEMPLATE.md §4). */
export default function UniformMotionLab({
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
  defaults: UniformMotionParams;
  initial: UniformMotionParams;
  canSave: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('labs');
  const m = useTranslations('labs.models.uniformMotion');
  const [params, setParams] = useState(initial);
  // Model time τ; at rest the lab shows the end of the motion (τ = t).
  const [tau, setTau] = useState(initial.t);
  const [running, setRunning] = useState(false);
  const clock = useRef(createClock());
  const frame = useRef(0);
  const saveStatus = useLabSession(code, params, canSave);

  const nf = useMemo(
    () => new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-RU', { maximumFractionDigits: 2 }),
    [locale],
  );
  const format = useCallback((n: number) => nf.format(n), [nf]);
  const unit = (u: keyof typeof UNIT_KEY) => t(`units.${UNIT_KEY[u]}`);

  const result = uniformMotion.compute(params);
  const S = params.v * Math.min(tau, params.t);
  const x = positionAt(params, tau);

  const stop = () => {
    cancelAnimationFrame(frame.current);
    setRunning(false);
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const run = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTau(params.t);
      return;
    }
    const startTau = tau >= params.t ? 0 : tau;
    clock.current.reset();
    setTau(startTau);
    setRunning(true);
    let last = performance.now();
    const step = (now: number) => {
      clock.current.advance((now - last) / 1000);
      last = now;
      const next = Math.min(startTau + clock.current.time, params.t);
      setTau(next);
      if (next >= params.t) setRunning(false);
      else frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };

  const change = (key: ParamKey, value: number) => {
    stop();
    const next = { ...params, [key]: value };
    setParams(next);
    setTau(next.t);
  };

  const reset = () => {
    stop();
    setParams(defaults);
    setTau(defaults.t);
  };

  const trackMax = Math.max(10, result.x);
  const panel = (
    <GameControls
      running={running}
      onRun={run}
      onPause={stop}
      onReset={reset}
      labels={{ run: t('run'), pause: t('pause'), reset: t('reset') }}
    >
      {PARAM_KEYS.map((key) => {
        const spec = uniformMotion.params[key];
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
          <div className="pt-8 sm:pt-6">
            <Track
              x0={params.x0}
              x={x}
              xEnd={result.x}
              scaleMax={trackMax}
              label={m('trackLabel')}
              unit={unit('m')}
              format={format}
            />
          </div>
          <GameReadouts
            title={t('readouts')}
            items={[
              {
                id: 'tau',
                label: m('readouts.tau'),
                symbol: 't',
                value: format(Math.min(tau, params.t)),
                unit: unit('s'),
              },
              { id: 'S', label: m('readouts.S'), symbol: 'S', value: format(S), unit: unit('m') },
              { id: 'x', label: m('readouts.x'), symbol: 'x', value: format(x), unit: unit('m') },
            ]}
          />
          <p className="text-sm" data-testid="formula">
            <span className="text-text-muted">{m('formula')}: </span>
            <span className="tabular-nums">
              {`S = v · t = ${format(params.v)} · ${format(params.t)} = ${format(result.S)} ${unit('m')}`}
            </span>
          </p>
          <GameChart
            title={m('chartTitle')}
            xLabel={`t, ${unit('s')}`}
            yLabel={`S, ${unit('m')}`}
            series={pathSeries(params)}
            xMax={Math.max(params.t, 1)}
            yMax={Math.max(result.S, 1)}
            marker={{ x: Math.min(tau, params.t), y: S }}
            description={m('chartDescription', { v: format(params.v), S: format(result.S) })}
          />
        </GameWorkspace>
      }
    >
      {children}
    </GameLayout>
  );
}

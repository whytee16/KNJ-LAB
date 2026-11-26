'use client';

import type { Locale } from '@knj/i18n';
import { CONVERGING, imageSeries, thinLens, type ThinLensParams } from '@knj/physics';
import { GameChart, GameReadouts } from '@knj/ui/game';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import { LabFrame3D, SceneLoading } from '../lab-frame-3d';
import { useLabSession } from '../use-lab-session';
import { CalcSteps, ModelControls, useLabFormat, useModelMessages } from './common';
import { LensSide2D } from './lens-side2d';

const LensScene3D = dynamic(() => import('./lens-scene3d'), { ssr: false, loading: SceneLoading });

/** «Тонкая линза»: optical bench with a candle, a lens and a screen. */
export default function LensLab({
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
  defaults: ThinLensParams;
  initial: ThinLensParams;
  canSave: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('labs');
  const m = useModelMessages(code);
  const { format, unit } = useLabFormat(locale);
  const [params, setParams] = useState(initial);
  const saveStatus = useLabSession(code, params, canSave);
  const r = thinLens.compute(params);
  const converging = params.kind === CONVERGING;
  const cm = unit('cm');
  const labels = {
    F: 'F',
    F2: '2F',
    screen: m('screen'),
    scale: m('scale'),
  };

  const kind = r.none
    ? m('image.none')
    : m('image.kind', {
        list: [
          m(r.real ? 'image.real' : 'image.virtual'),
          m(r.H < 0 ? 'image.inverted' : 'image.upright'),
          m(r.G > 1 + 1e-9 ? 'image.magnified' : r.G < 1 - 1e-9 ? 'image.reduced' : 'image.same'),
        ].join(', '),
      });
  const screen =
    r.none || !r.real
      ? m('screenNothing')
      : r.blur < 0.3
        ? m('screenSharp')
        : m('screenBlur', { f: format(r.f) });

  const Fsigned = converging ? params.F : -params.F;
  const steps = r.none
    ? [m('step.focal')]
    : [
        m('step.formula', { F: format(Fsigned), d: format(params.d), f: format(r.f), cm }),
        m('step.magnification', { f: format(Math.abs(r.f)), d: format(params.d), G: format(r.G) }),
        m('step.height', { h: format(params.h), G: format(r.G), H: format(Math.abs(r.H)), cm }),
        m('step.power', { F: format(Fsigned / 100), D: format(r.D) }),
      ];
  const { near, far } = imageSeries(params);
  const yMax = 100;

  return (
    <LabFrame3D
      header={header}
      controls={
        <ModelControls
          model={thinLens}
          params={params}
          locale={locale}
          onChange={(k, v) => setParams({ ...params, [k]: v })}
        />
      }
      running={false}
      onRun={() => {}}
      onPause={() => {}}
      onReset={() => setParams(defaults)}
      runnable={false}
      canSave={canSave}
      saveStatus={saveStatus}
      scene3d={(h) => (
        <LensScene3D
          {...h}
          params={params}
          labels={labels}
          label={m('scene3d')}
          resetLabel={t('view.resetCamera')}
        />
      )}
      scene2d={<LensSide2D params={params} label={m('scene2d')} labels={labels} />}
      below={
        <>
          <p role="status" data-testid="optics-status" className="text-sm font-medium">
            {kind}
          </p>
          <p className="text-sm" data-testid="screen-state">
            {screen}
          </p>
          <GameReadouts
            title={m('resultsTitle')}
            items={[
              {
                id: 'f',
                label: m('results.f'),
                symbol: 'f',
                value: r.none ? '—' : format(r.f),
                unit: r.none ? '' : cm,
              },
              {
                id: 'G',
                label: m('results.G'),
                symbol: 'Γ',
                value: r.none ? '—' : format(r.G),
                unit: '',
              },
              {
                id: 'H',
                label: m('results.H'),
                symbol: 'H',
                value: r.none ? '—' : format(Math.abs(r.H)),
                unit: r.none ? '' : cm,
              },
              {
                id: 'D',
                label: m('results.D'),
                symbol: 'D',
                value: format(r.D),
                unit: unit('dpt'),
              },
            ]}
          />
          <CalcSteps title={m('stepsTitle')} testId="optics-steps" steps={steps} />
          <GameChart
            title={m('chartTitle')}
            xLabel={`d, ${cm}`}
            yLabel={`f, ${cm}`}
            series={far}
            label={converging ? m('chartReal') : m('chartVirtual')}
            more={
              converging && near.length
                ? [{ points: near, tone: 'muted', label: m('chartVirtual') }]
                : undefined
            }
            xMax={60}
            yMax={yMax}
            yMin={-yMax}
            marker={r.none || Math.abs(r.f) > yMax ? undefined : { x: params.d, y: r.f }}
            description={m('chartDescription', { F: format(params.F) })}
          />
        </>
      }
    >
      {children}
    </LabFrame3D>
  );
}

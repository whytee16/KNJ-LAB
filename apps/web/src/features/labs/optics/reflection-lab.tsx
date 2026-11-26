'use client';

import type { Locale } from '@knj/i18n';
import { reflection, type ReflectionParams } from '@knj/physics';
import { GameChart, GameReadouts } from '@knj/ui/game';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import { LabFrame3D, SceneLoading } from '../lab-frame-3d';
import { useLabSession } from '../use-lab-session';
import { CalcSteps, ModelControls, useLabFormat, useModelMessages } from './common';
import { ReflectionSide2D } from './reflection-side2d';

const ReflectionScene3D = dynamic(() => import('./reflection-scene3d'), {
  ssr: false,
  loading: SceneLoading,
});

/** «Отражение света. Плоское зеркало». A static bench: no Run, everything follows the controls. */
export default function ReflectionLab({
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
  defaults: ReflectionParams;
  initial: ReflectionParams;
  canSave: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('labs');
  const m = useModelMessages(code);
  const { format, unit } = useLabFormat(locale);
  const [params, setParams] = useState(initial);
  const saveStatus = useLabSession(code, params, canSave);
  const r = reflection.compute(params);
  const labels = { image: m('image'), candle: m('candle'), mirror: m('mirror') };
  const deg = unit('deg');
  const cm = unit('cm');

  return (
    <LabFrame3D
      header={header}
      controls={
        <ModelControls
          model={reflection}
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
        <ReflectionScene3D
          {...h}
          params={params}
          labels={labels}
          label={m('scene3d')}
          resetLabel={t('view.resetCamera')}
        />
      )}
      scene2d={<ReflectionSide2D params={params} label={m('scene2d')} labels={labels} />}
      below={
        <>
          <p role="status" data-testid="optics-status" className="text-sm font-medium">
            {m('status', { i: format(r.i), r: format(r.r) })}
          </p>
          <GameReadouts
            title={m('resultsTitle')}
            items={(['i', 'r', 'turn', 'dObj', 'dImg'] as const).map((k) => ({
              id: k,
              label: m(`results.${k}`),
              symbol: reflection.results[k].symbol,
              value: format(r[k]),
              unit: unit(reflection.results[k].unit),
            }))}
          />
          <CalcSteps
            title={m('stepsTitle')}
            testId="optics-steps"
            steps={[
              m('step.law', { i: format(r.i), r: format(r.r), deg }),
              m('step.turn', { phi: format(params.phi), turn: format(r.turn), deg }),
              m('step.image', { a: format(r.dObj), b: format(r.dImg), cm }),
            ]}
          />
          <GameChart
            title={m('chartTitle')}
            xLabel={`α, ${deg}`}
            yLabel={`β, ${deg}`}
            series={[
              { x: 0, y: 0 },
              { x: 90, y: 90 },
            ]}
            xMax={90}
            yMax={90}
            marker={{ x: r.i, y: r.r }}
            description={m('chartDescription')}
          />
        </>
      }
    >
      {children}
    </LabFrame3D>
  );
}

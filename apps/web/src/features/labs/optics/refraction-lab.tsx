'use client';

import type { Locale } from '@knj/i18n';
import { mediaOf, refraction, refractionSeries, type RefractionParams } from '@knj/physics';
import { GameChart, GameReadouts } from '@knj/ui/game';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import { LabFrame3D, SceneLoading } from '../lab-frame-3d';
import { useLabSession } from '../use-lab-session';
import { CalcSteps, ModelControls, useLabFormat, useModelMessages } from './common';
import { RefractionSide2D } from './refraction-side2d';

const RefractionScene3D = dynamic(() => import('./refraction-scene3d'), {
  ssr: false,
  loading: SceneLoading,
});

/** «Преломление света. Полное отражение». */
export default function RefractionLab({
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
  defaults: RefractionParams;
  initial: RefractionParams;
  canSave: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('labs');
  const m = useModelMessages(code);
  const { format, unit } = useLabFormat(locale);
  const [params, setParams] = useState(initial);
  const saveStatus = useLabSession(code, params, canSave);
  const r = refraction.compute(params);
  const { pair } = mediaOf(params);
  const toDense = r.n1 <= r.n2;
  const labels = {
    tir: m('tir'),
    medium1: m(`media.${pair.from}`),
    medium2: m(`media.${pair.to}`),
  };
  const deg = unit('deg');
  const sinA = Math.sin((params.alpha * Math.PI) / 180);

  const steps = [
    m('step.snell', { n1: format(r.n1), n2: format(r.n2) }),
    r.tir
      ? m('step.tir', {
          s: format((r.n1 / r.n2) * sinA),
          a0: format(r.critical),
          deg,
        })
      : m('step.gamma', {
          n1: format(r.n1),
          n2: format(r.n2),
          alpha: format(params.alpha),
          s: format((r.n1 / r.n2) * sinA),
          gamma: format(r.gamma),
          deg,
        }),
    toDense
      ? m('step.toDense')
      : m('step.critical', { n1: format(r.n1), a0: format(r.critical), deg }),
  ];

  const series = refractionSeries(params);
  return (
    <LabFrame3D
      header={header}
      controls={
        <ModelControls
          model={refraction}
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
        <RefractionScene3D
          {...h}
          params={params}
          labels={labels}
          label={m('scene3d')}
          resetLabel={t('view.resetCamera')}
        />
      )}
      scene2d={<RefractionSide2D params={params} label={m('scene2d')} labels={labels} />}
      below={
        <>
          <p role="status" data-testid="optics-status" className="text-sm font-medium">
            {r.tir
              ? m('statusTir', { a0: format(r.critical) })
              : m(toDense ? 'statusToDense' : 'statusToRare', { gamma: format(r.gamma) })}
          </p>
          <GameReadouts
            title={m('resultsTitle')}
            items={[
              ...(['n1', 'n2', 'n', 'beta'] as const).map((k) => ({
                id: k,
                label: m(`results.${k}`),
                symbol: refraction.results[k].symbol,
                value: format(r[k]),
                unit: unit(refraction.results[k].unit),
              })),
              {
                id: 'gamma',
                label: m('results.gamma'),
                symbol: 'γ',
                value: r.tir ? '—' : format(r.gamma),
                unit: r.tir ? '' : deg,
              },
              ...(toDense
                ? []
                : [
                    {
                      id: 'critical',
                      label: m('results.critical'),
                      symbol: 'α₀',
                      value: format(r.critical),
                      unit: deg,
                    },
                  ]),
            ]}
          />
          <CalcSteps title={m('stepsTitle')} testId="optics-steps" steps={steps} />
          <GameChart
            title={m('chartTitle')}
            xLabel={`α, ${deg}`}
            yLabel={`γ, ${deg}`}
            series={series}
            xMax={90}
            yMax={90}
            marker={r.tir ? undefined : { x: params.alpha, y: r.gamma }}
            description={m(toDense ? 'chartToDense' : 'chartToRare', { a0: format(r.critical) })}
          />
        </>
      }
    >
      {children}
    </LabFrame3D>
  );
}

'use client';

import type { Locale } from '@knj/i18n';
import type { LabModel, ParamSpec, Values } from '@knj/physics';
import { ChoiceControl, ParamControl } from '@knj/ui/game';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { camelCode, unitText } from '../units';

/** Number formatting and unit texts of a lab page. */
export function useLabFormat(locale: Locale) {
  const t = useTranslations('labs');
  const nf = useMemo(
    () => new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-RU', { maximumFractionDigits: 2 }),
    [locale],
  );
  const format = useCallback((n: number) => nf.format(Math.abs(n) < 1e-9 ? 0 : n), [nf]);
  const unit = useCallback((u: Parameters<typeof unitText>[1]) => unitText(t, u), [t]);
  return { format, unit };
}

/** Messages of a lab model: labs.models.<code in camelCase>.<key>. */
export function useModelMessages(code: string) {
  const all = useTranslations();
  const base = `labs.models.${camelCode(code)}`;
  return useCallback(
    (key: string, values?: Record<string, string | number>) =>
      all(`${base}.${key}` as 'labs.title', values as never),
    [all, base],
  );
}

/** Parameter controls of any lab model: choices as radio buttons, ranges as slider + number. */
export function ModelControls<P extends Values>({
  model,
  params,
  onChange,
  locale,
  only,
}: {
  model: LabModel<P>;
  params: P;
  onChange: (key: keyof P & string, value: number) => void;
  locale: Locale;
  only?: (keyof P & string)[];
}) {
  const t = useTranslations('labs');
  const m = useModelMessages(model.code);
  const { format, unit } = useLabFormat(locale);
  const keys = only ?? (Object.keys(model.params) as (keyof P & string)[]);
  return (
    <>
      {keys.map((k) => {
        const spec = model.params[k] as ParamSpec;
        return spec.choices ? (
          <ChoiceControl
            key={k}
            label={m(`params.${k}`)}
            symbol={spec.symbol}
            value={params[k]!}
            onChange={(v) => onChange(k, v)}
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
            onChange={(v) => onChange(k, v)}
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
}

/** «How we calculate»: numbered steps with the current numbers. */
export function CalcSteps({
  title,
  steps,
  testId,
}: {
  title: string;
  steps: string[];
  testId: string;
}) {
  return (
    <section
      aria-labelledby={`${testId}-title`}
      className="flex flex-col gap-2"
      data-testid={testId}
    >
      <h3 id={`${testId}-title`} className="text-sm font-semibold">
        {title}
      </h3>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </section>
  );
}

/** World (cm) → SVG pixels with the same scale on both axes unless `ky` is given. */
export function svgFrame(
  W: number,
  H: number,
  box: { x0: number; x1: number; y0: number; y1: number },
  pad = 24,
  stretchY = 1,
) {
  const kx = Math.min(
    (W - 2 * pad) / (box.x1 - box.x0),
    (H - 2 * pad) / ((box.y1 - box.y0) * stretchY),
  );
  const ky = kx * stretchY;
  const ox = pad + (W - 2 * pad - (box.x1 - box.x0) * kx) / 2;
  const oy = pad + (H - 2 * pad - (box.y1 - box.y0) * ky) / 2;
  return {
    X: (x: number) => ox + (x - box.x0) * kx,
    Y: (y: number) => oy + (box.y1 - y) * ky,
    kx,
    ky,
  };
}

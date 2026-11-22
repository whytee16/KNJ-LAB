'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Button } from '../components/button.tsx';
import { cn } from '../cn.ts';

export interface RangeSpec {
  min: number;
  max: number;
  step: number;
}

const decimals = (n: number) => {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};

/** Range + step snapping (mirrors `clampParam` of the physics package). */
export function snapToRange(spec: RangeSpec, value: number): number {
  const within = Math.min(spec.max, Math.max(spec.min, value));
  const snapped = spec.min + Math.round((within - spec.min) / spec.step) * spec.step;
  return Math.min(
    spec.max,
    Number(snapped.toFixed(Math.max(decimals(spec.step), decimals(spec.min)))),
  );
}

const fmt = (n: number) => String(n).replace('.', ',');
const parse = (s: string) => Number(s.trim().replace(',', '.').replace(/\s/g, ''));

/**
 * One parameter: a slider and a number field kept in sync. Typed values are validated
 * against the range; an out-of-range value is not applied and the allowed range is shown.
 */
export function ParamControl({
  label,
  symbol,
  unit,
  spec,
  value,
  onChange,
  rangeError,
  disabled,
}: {
  label: string;
  symbol: string;
  unit: string;
  spec: RangeSpec;
  value: number;
  onChange: (value: number) => void;
  /** Message shown when the typed value is invalid, e.g. "Допустимо от 0 до 30". */
  rangeError: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(fmt(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(fmt(value));
    setInvalid(false);
  }, [value]);

  const commit = () => {
    const n = parse(text);
    if (!text.trim() || !Number.isFinite(n) || n < spec.min || n > spec.max) {
      setInvalid(true);
      return;
    }
    const next = snapToRange(spec, n);
    setInvalid(false);
    setText(fmt(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`${id}-num`} className="text-sm font-medium">
          {label} <span className="font-normal text-text-muted italic">{symbol}</span>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label={label}
          aria-valuetext={`${fmt(value)} ${unit}`}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(snapToRange(spec, Number(e.target.value)))}
          className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            id={`${id}-num`}
            inputMode="decimal"
            autoComplete="off"
            value={text}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-err` : undefined}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
            className={cn(
              'min-h-11 w-20 rounded-md border border-border bg-surface px-2 text-right tabular-nums',
              'focus-visible:outline-2 focus-visible:outline-accent aria-[invalid=true]:border-danger',
            )}
          />
          <span className="w-10 text-sm text-text-muted">{unit}</span>
        </div>
      </div>
      {invalid ? (
        <p id={`${id}-err`} className="text-sm text-danger">
          {rangeError}
        </p>
      ) : null}
    </div>
  );
}

/** Parameter list with Run / Pause / Reset. */
export function GameControls({
  children,
  running,
  onRun,
  onPause,
  onReset,
  labels,
}: {
  children: ReactNode;
  running: boolean;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  labels: { run: string; pause: string; reset: string };
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">{children}</div>
      <div className="flex flex-wrap gap-2">
        {running ? (
          <Button onClick={onPause}>{labels.pause}</Button>
        ) : (
          <Button onClick={onRun}>{labels.run}</Button>
        )}
        <Button variant="secondary" onClick={onReset}>
          {labels.reset}
        </Button>
      </div>
    </div>
  );
}

/** A parameter with a fixed set of values (e.g. g on different planets), as radio buttons. */
export function ChoiceControl({
  label,
  symbol,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  symbol: string;
  options: { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="text-sm font-medium">
        {label} <span className="font-normal text-text-muted italic">{symbol}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="size-4 accent-[var(--accent)]"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

'use client';

import type { Answer } from '@knj/task-engine';
import { cn } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useState } from 'react';
import { FormulaInput } from './formula-input';
import type { RenderedPrompt } from './types';

const Html = ({ html, className }: { html: string; className?: string }) => (
  <span className={cn('[&_p]:inline', className)} dangerouslySetInnerHTML={{ __html: html }} />
);

/** Type-specific answer controls; reports the current answer through `onChange`. */
export function AnswerInput({
  prompt,
  disabled,
  onChange,
}: {
  prompt: RenderedPrompt;
  disabled: boolean;
  onChange: (answer: Answer) => void;
}) {
  const t = useTranslations('practice');
  const id = useId();
  const [order, setOrder] = useState(prompt.options?.map((o) => o.id) ?? []);
  const [picked, setPicked] = useState<string[]>([]);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  // Controlled inputs: React 19 resets uncontrolled fields after a form action, which would
  // erase the student's answer right when the feedback appears.
  const [text, setText] = useState('');
  const [single, setSingle] = useState('');
  const onFormula = useCallback((latex: string) => onChange(latex), [onChange]);

  switch (prompt.type) {
    case 'number':
      return (
        <div className="flex items-center gap-3">
          <label htmlFor={id} className="sr-only">
            {t('answer')}
          </label>
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            placeholder={t('numberPlaceholder')}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onChange(e.target.value);
            }}
            className="min-h-11 w-48 rounded-md border border-border bg-surface px-3 text-lg"
          />
          {prompt.unit ? <span className="text-text-muted">{prompt.unit}</span> : null}
        </div>
      );
    case 'cloze_word':
      return (
        <div>
          <label htmlFor={id} className="sr-only">
            {t('answer')}
          </label>
          <input
            id={id}
            autoComplete="off"
            disabled={disabled}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onChange(e.target.value);
            }}
            className="min-h-11 w-full max-w-sm rounded-md border border-border bg-surface px-3 text-lg"
          />
        </div>
      );
    case 'formula':
      return (
        <div className="flex flex-col gap-2">
          <FormulaInput
            id={id}
            label={t('formulaLabel', { variables: (prompt.variables ?? []).join(', ') })}
            onChange={onFormula}
          />
          <p className="text-sm text-text-muted">{t('formulaHint')}</p>
        </div>
      );
    case 'single_choice':
      return (
        <fieldset className="flex flex-col gap-2" disabled={disabled}>
          <legend className="sr-only">{t('chooseOne')}</legend>
          {prompt.options!.map((o) => (
            <label
              key={o.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 has-[:checked]:border-accent"
            >
              <input
                type="radio"
                name={`${id}-choice`}
                value={o.id}
                checked={single === o.id}
                onChange={() => {
                  setSingle(o.id);
                  onChange(o.id);
                }}
                className="size-5 accent-[var(--accent)]"
              />
              <Html html={o.html} />
            </label>
          ))}
        </fieldset>
      );
    case 'multi_choice':
      return (
        <fieldset className="flex flex-col gap-2" disabled={disabled}>
          <legend className="mb-1 text-sm text-text-muted">{t('chooseMany')}</legend>
          {prompt.options!.map((o) => (
            <label
              key={o.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 has-[:checked]:border-accent"
            >
              <input
                type="checkbox"
                value={o.id}
                checked={picked.includes(o.id)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...picked, o.id]
                    : picked.filter((p) => p !== o.id);
                  setPicked(next);
                  onChange(next);
                }}
                className="size-5 accent-[var(--accent)]"
              />
              <Html html={o.html} />
            </label>
          ))}
        </fieldset>
      );
    case 'ordering': {
      const move = (i: number, d: -1 | 1) => {
        const next = [...order];
        [next[i], next[i + d]] = [next[i + d]!, next[i]!];
        setOrder(next);
        onChange(next);
      };
      const byId = new Map(prompt.options!.map((o) => [o.id, o]));
      return (
        <div>
          <p className="mb-2 text-sm text-text-muted">{t('orderHint')}</p>
          <ol className="flex flex-col gap-2">
            {order.map((oid, i) => (
              <li
                key={oid}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1"
              >
                <span className="w-6 text-text-muted">{i + 1}.</span>
                <Html html={byId.get(oid)!.html} className="flex-1" />
                <button
                  type="button"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={t('moveUp')}
                  className="min-h-11 min-w-11 rounded-md hover:bg-surface-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled || i === order.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={t('moveDown')}
                  className="min-h-11 min-w-11 rounded-md hover:bg-surface-muted disabled:opacity-30"
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    case 'matching':
      return (
        <div className="flex flex-col gap-3">
          {prompt.left!.map((l) => (
            <div key={l.id} className="grid items-center gap-2 sm:grid-cols-2">
              <label htmlFor={`${id}-${l.id}`}>
                <Html html={l.html} />
              </label>
              <select
                id={`${id}-${l.id}`}
                disabled={disabled}
                value={pairs[l.id] ?? ''}
                onChange={(e) => {
                  const next = { ...pairs, [l.id]: e.target.value };
                  setPairs(next);
                  onChange(next);
                }}
                className="min-h-11 rounded-md border border-border bg-surface px-3"
              >
                <option value="" disabled>
                  {t('choosePair')}
                </option>
                {prompt.right!.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.text}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
  }
}

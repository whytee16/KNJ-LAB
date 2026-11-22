'use client';

import type { Locale } from '@knj/i18n';
import { CheckboxField, SelectField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useId } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { changeLabLink, saveLab, setLabStatus, type LabLinkState } from './lab-actions';

type Option = { value: string; label: string };

export interface ParamField {
  key: string;
  label: string;
  hint: string;
}

function TextArea({
  name,
  label,
  hint,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={4}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="rounded-md border border-border bg-surface p-3 text-base aria-[invalid=true]:border-danger"
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function LabEditor({
  locale,
  labId,
  initial,
  params,
  locked,
}: {
  locale: Locale;
  labId: string;
  initial: Record<string, string>;
  params: ParamField[];
  locked: boolean;
}) {
  const t = useTranslations('studio.labs');
  const m = useMessage();
  const [state, action] = useActionState(saveLab, idle);
  const v = state.values ?? initial;
  const err = (f: string) => m(state.fieldErrors?.[f]);
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="labId" value={labId} />
      <FormAlert state={state} />
      <fieldset className="flex flex-col gap-6" disabled={locked}>
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-lg font-semibold">{t('ru')}</legend>
          <TextField
            name="titleRu"
            label={t('title')}
            defaultValue={v.titleRu}
            error={err('titleRu')}
          />
          <TextArea name="goalRu" label={t('goal')} defaultValue={v.goalRu} error={err('goalRu')} />
          <TextArea
            name="stepsRu"
            label={t('steps')}
            hint={t('linesHint')}
            defaultValue={v.stepsRu}
            error={err('stepsRu')}
          />
          <TextArea
            name="hintsRu"
            label={t('hints')}
            hint={t('linesHint')}
            defaultValue={v.hintsRu}
            error={err('hintsRu')}
          />
        </fieldset>
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-lg font-semibold">{t('kk')}</legend>
          <TextField name="titleKk" label={t('title')} defaultValue={v.titleKk} />
          <TextArea name="goalKk" label={t('goal')} defaultValue={v.goalKk} />
          <TextArea
            name="stepsKk"
            label={t('steps')}
            hint={t('linesHint')}
            defaultValue={v.stepsKk}
          />
          <TextArea
            name="hintsKk"
            label={t('hints')}
            hint={t('linesHint')}
            defaultValue={v.hintsKk}
          />
          <SelectField
            name="kkStatus"
            label={t('kkStatus')}
            defaultValue={v.kkStatus ?? 'draft'}
            options={(['draft', 'in_review', 'approved'] as const).map((s) => ({
              value: s,
              label: t(`kkStatuses.${s}`),
            }))}
          />
        </fieldset>
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-lg font-semibold">{t('defaults')}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {params.map((p) => (
              <TextField
                key={p.key}
                name={`param_${p.key}`}
                label={p.label}
                hint={p.hint}
                inputMode="decimal"
                defaultValue={v[`param_${p.key}`]}
                error={err(`param_${p.key}`)}
              />
            ))}
          </div>
          <SelectField
            name="grade"
            label={t('grade')}
            defaultValue={v.grade ?? '7'}
            options={['7', '8', '9', '10', '11'].map((g) => ({ value: g, label: g }))}
          />
          <CheckboxField
            name="isFreeDemo"
            label={t('freeDemo')}
            defaultChecked={v.isFreeDemo === 'on'}
          />
          <p className="text-sm text-text-muted">{t('freeDemoHint')}</p>
        </fieldset>
      </fieldset>
      {!locked ? (
        <div>
          <SubmitButton>{t('save')}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

/** Linked topics or question templates: list with remove, select with add. */
export function LabLinks({
  locale,
  labId,
  list,
  title,
  hint,
  linked,
  options,
  locked,
}: {
  locale: Locale;
  labId: string;
  list: 'topics' | 'tasks';
  title: string;
  hint: string;
  linked: Option[];
  options: Option[];
  locked: boolean;
}) {
  const t = useTranslations('studio.labs');
  const [state, action] = useActionState<LabLinkState, FormData>(changeLabLink, idle);
  const free = options.filter((o) => !linked.some((l) => l.value === o.value));
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="labId" value={labId} />
      <input type="hidden" name="list" value={list} />
    </>
  );
  return (
    <section
      aria-labelledby={`links-${list}`}
      className="flex flex-col gap-3"
      data-testid={`links-${list}`}
    >
      <h2 id={`links-${list}`} className="text-lg font-semibold">
        {title}
      </h2>
      <p className="text-sm text-text-muted">{hint}</p>
      {state.list === list ? <FormAlert state={state} /> : null}
      {linked.length ? (
        <ul className="flex flex-col divide-y divide-border">
          {linked.map((l) => (
            <li key={l.value} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 break-words">{l.label}</span>
              {!locked ? (
                <form action={action}>
                  {hidden}
                  <input type="hidden" name="op" value="remove" />
                  <input type="hidden" name="target" value={l.value} />
                  <SubmitButton size="sm" variant="ghost">
                    {t('remove')}
                  </SubmitButton>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{t('nothingLinked')}</p>
      )}
      {!locked && free.length ? (
        <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {hidden}
          <input type="hidden" name="op" value="add" />
          <div className="min-w-0 flex-1">
            <SelectField
              name="target"
              label={t(list === 'topics' ? 'addTopic' : 'addTask')}
              options={free}
            />
          </div>
          <SubmitButton size="sm" variant="secondary">
            {t('add')}
          </SubmitButton>
        </form>
      ) : null}
    </section>
  );
}

export function LabStatusPanel({
  locale,
  labId,
  status,
  canReview,
}: {
  locale: Locale;
  labId: string;
  status: string;
  canReview: boolean;
}) {
  const t = useTranslations('studio.formula');
  const [state, action] = useActionState(setLabStatus, idle);
  const button = (target: string, label: string, primary = false) => (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="labId" value={labId} />
      <input type="hidden" name="status" value={target} />
      <SubmitButton size="sm" variant={primary ? 'primary' : 'secondary'}>
        {label}
      </SubmitButton>
    </form>
  );
  return (
    <div className="flex flex-col gap-3">
      <FormAlert state={state} />
      {status === 'draft' ? button('in_review', t('submit'), true) : null}
      {canReview && status !== 'published' ? button('published', t('publish'), true) : null}
      {canReview && status !== 'draft' ? button('draft', t('backToDraft')) : null}
    </div>
  );
}

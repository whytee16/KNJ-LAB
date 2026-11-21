'use client';

import type { Locale } from '@knj/i18n';
import { SelectField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useId } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { createFormula, saveFormula } from './formula-actions';

const GRADES = ['7', '8', '9', '10', '11'];

function Area({
  name,
  label,
  hint,
  defaultValue,
  error,
  rows = 3,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue: string;
  error?: string;
  rows?: number;
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
        rows={rows}
        defaultValue={defaultValue}
        aria-describedby={`${id}-d`}
        className="rounded-md border border-border bg-surface p-3 font-mono text-sm"
      />
      {hint || error ? (
        <p id={`${id}-d`} className={`text-sm ${error ? 'text-danger' : 'text-text-muted'}`}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

function NeutralFields({
  values,
  errors,
  subjects,
}: {
  values: Record<string, string>;
  errors: Record<string, string | undefined>;
  subjects: { value: string; label: string }[];
}) {
  const t = useTranslations('studio.formula.fields');
  const gradeOptions = GRADES.map((g) => ({ value: g, label: g }));
  return (
    <>
      <TextField
        name="latex"
        label={t('latex')}
        hint={t('latexHint')}
        className="font-mono"
        defaultValue={values.latex}
        error={errors.latex}
      />
      <TextField
        name="code"
        label={t('code')}
        hint={t('codeHint')}
        autoCapitalize="none"
        defaultValue={values.code}
        error={errors.code}
      />
      <SelectField
        name="subject"
        label={t('subject')}
        options={subjects}
        defaultValue={values.subject}
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          name="gradeFrom"
          label={t('gradeFrom')}
          options={gradeOptions}
          defaultValue={values.gradeFrom ?? '7'}
        />
        <SelectField
          name="gradeTo"
          label={t('gradeTo')}
          options={gradeOptions}
          defaultValue={values.gradeTo ?? '11'}
          error={errors.gradeTo}
        />
      </div>
    </>
  );
}

export function NewFormulaForm({
  locale,
  subjects,
}: {
  locale: Locale;
  subjects: { value: string; label: string }[];
}) {
  const t = useTranslations('studio.formula');
  const m = useMessage();
  const [state, action] = useActionState(createFormula, idle);
  const errors = Object.fromEntries(
    Object.entries(state.fieldErrors ?? {}).map(([k, v]) => [k, m(v)]),
  );
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormAlert state={state} />
      <TextField
        name="name"
        label={t('fields.nameRu')}
        defaultValue={state.values?.name}
        error={errors.name}
      />
      <NeutralFields values={state.values ?? {}} errors={errors} subjects={subjects} />
      <SubmitButton>{t('create')}</SubmitButton>
    </form>
  );
}

export function FormulaEditor({
  locale,
  formulaId,
  initial,
  subjects,
}: {
  locale: Locale;
  formulaId: string;
  initial: Record<string, string>;
  subjects: { value: string; label: string }[];
}) {
  const t = useTranslations('studio.formula');
  const m = useMessage();
  const [state, action] = useActionState(saveFormula, idle);
  const values = state.values ?? initial;
  const errors = Object.fromEntries(
    Object.entries(state.fieldErrors ?? {}).map(([k, v]) => [k, m(v)]),
  );
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="formulaId" value={formulaId} />
      <FormAlert state={state} />
      <NeutralFields values={values} errors={errors} subjects={subjects} />
      {(['ru', 'kk'] as const).map((lang) => (
        <fieldset key={lang} className="flex flex-col gap-4 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-semibold">{t(`fields.texts.${lang}`)}</legend>
          <TextField
            name={`name_${lang}`}
            label={t('fields.name')}
            defaultValue={values[`name_${lang}`]}
            error={errors[`name_${lang}`]}
          />
          <Area
            name={`description_${lang}`}
            label={t('fields.description')}
            defaultValue={values[`description_${lang}`] ?? ''}
            error={errors[`description_${lang}`]}
          />
          <Area
            name={`variables_${lang}`}
            label={t('fields.variables')}
            hint={t('fields.variablesHint')}
            defaultValue={values[`variables_${lang}`] ?? ''}
            error={errors[`variables_${lang}`]}
            rows={4}
          />
        </fieldset>
      ))}
      <SubmitButton>{t('save')}</SubmitButton>
    </form>
  );
}

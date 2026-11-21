'use client';

import type { Locale } from '@knj/i18n';
import { CheckboxField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useId } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { saveTopicDraft } from './topic-actions';

export interface DraftValues {
  title: string;
  summary: string;
  objectives: string;
  theory: string;
  mistakes: string;
  isMachineTranslation: boolean;
}

function TextArea({
  name,
  label,
  hint,
  rows,
  defaultValue,
  error,
  mono,
}: {
  name: string;
  label: string;
  hint?: string;
  rows: number;
  defaultValue: string;
  error?: string;
  mono?: boolean;
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
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-desc` : undefined}
        className={`w-full rounded-md border border-border bg-surface p-3 text-base focus-visible:outline-2 focus-visible:outline-accent ${mono ? 'font-mono text-sm' : ''}`}
      />
      {hint || error ? (
        <p id={`${id}-desc`} className={`text-sm ${error ? 'text-danger' : 'text-text-muted'}`}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

export function TopicEditor({
  locale,
  topicId,
  lang,
  initial,
}: {
  locale: Locale;
  topicId: string;
  lang: Locale;
  initial: DraftValues;
}) {
  const t = useTranslations('studio.topic');
  const m = useMessage();
  const [state, action] = useActionState(saveTopicDraft, idle);
  const v = state.values;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="contentLocale" value={lang} />
      <FormAlert state={state} />
      <TextField
        name="title"
        label={t('fields.title')}
        maxLength={150}
        defaultValue={v?.title ?? initial.title}
        error={m(state.fieldErrors?.title)}
      />
      <TextArea
        name="summary"
        label={t('fields.summary')}
        rows={2}
        defaultValue={v?.summary ?? initial.summary}
        error={m(state.fieldErrors?.summary)}
      />
      <TextArea
        name="objectives"
        label={t('fields.objectives')}
        hint={t('fields.oneProLine')}
        rows={4}
        defaultValue={v?.objectives ?? initial.objectives}
        error={m(state.fieldErrors?.objectives)}
      />
      <TextArea
        name="theory"
        label={t('fields.theory')}
        hint={t('fields.theoryHint')}
        rows={16}
        mono
        defaultValue={v?.theory ?? initial.theory}
        error={m(state.fieldErrors?.theory)}
      />
      <TextArea
        name="mistakes"
        label={t('fields.mistakes')}
        hint={t('fields.oneProLine')}
        rows={4}
        defaultValue={v?.mistakes ?? initial.mistakes}
        error={m(state.fieldErrors?.mistakes)}
      />
      {lang !== 'ru' ? (
        <CheckboxField
          name="isMachineTranslation"
          label={t('fields.machine')}
          defaultChecked={initial.isMachineTranslation}
        />
      ) : null}
      <SubmitButton>{t('save')}</SubmitButton>
    </form>
  );
}

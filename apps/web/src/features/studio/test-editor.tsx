'use client';

import { DIFFICULTIES } from '@knj/task-engine';
import type { Locale } from '@knj/i18n';
import { SelectField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { saveTest, setTestStatus } from './test-actions';

type Option = { value: string; label: string };

export function TestEditor({
  locale,
  testId,
  initial,
  topics,
  sections,
  subjects,
  locked,
}: {
  locale: Locale;
  testId?: string;
  initial: Record<string, string>;
  topics: Option[];
  sections: Option[];
  subjects: Option[];
  locked: boolean;
}) {
  const t = useTranslations('studio.tests');
  const levels = useTranslations('practice.levels');
  const m = useMessage();
  const [state, action] = useActionState(saveTest, idle);
  const v = state.values ?? initial;
  const [scope, setScope] = useState(v.scope ?? 'topic');
  const [mode, setMode] = useState(v.mode ?? 'practice');
  const err = (f: string) => m(state.fieldErrors?.[f]);
  const grades = ['7', '8', '9', '10', '11'].map((g) => ({ value: g, label: g }));
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {testId ? <input type="hidden" name="testId" value={testId} /> : null}
      <FormAlert state={state} />
      <fieldset className="flex flex-col gap-4" disabled={locked}>
        <TextField
          name="titleRu"
          label={t('titleRu')}
          defaultValue={v.titleRu}
          error={err('titleRu')}
        />
        <TextField name="descriptionRu" label={t('descriptionRu')} defaultValue={v.descriptionRu} />
        <TextField name="titleKk" label={t('titleKk')} defaultValue={v.titleKk} />
        <TextField name="descriptionKk" label={t('descriptionKk')} defaultValue={v.descriptionKk} />
        <SelectField
          name="scope"
          label={t('scope')}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          options={(['topic', 'section', 'quarter', 'grade', 'subject'] as const).map((s) => ({
            value: s,
            label: t(`scopes.${s}`),
          }))}
        />
        {scope === 'topic' ? (
          <SelectField
            name="topicId"
            label={t('topic')}
            defaultValue={v.topicId}
            options={topics}
            error={err('topicId')}
          />
        ) : null}
        {scope === 'section' ? (
          <SelectField
            name="sectionId"
            label={t('section')}
            defaultValue={v.sectionId}
            options={sections}
            error={err('sectionId')}
          />
        ) : null}
        {['quarter', 'grade', 'subject'].includes(scope) ? (
          <SelectField
            name="subject"
            label={t('subject')}
            defaultValue={v.subject}
            options={subjects}
          />
        ) : null}
        {['quarter', 'grade'].includes(scope) ? (
          <SelectField
            name="grade"
            label={t('grade')}
            defaultValue={v.grade ?? '7'}
            options={grades}
          />
        ) : null}
        {scope === 'quarter' ? (
          <SelectField
            name="quarter"
            label={t('quarter')}
            defaultValue={v.quarter ?? '1'}
            options={['1', '2', '3', '4'].map((q) => ({ value: q, label: q }))}
          />
        ) : null}
        <SelectField
          name="mode"
          label={t('mode')}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          options={[
            { value: 'practice', label: t('modes.practice') },
            { value: 'exam', label: t('modes.exam') },
          ]}
        />
        {mode === 'exam' ? (
          <TextField
            name="minutes"
            label={t('minutes')}
            inputMode="numeric"
            defaultValue={v.minutes ?? '20'}
            error={err('minutes')}
          />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-4">
          {DIFFICULTIES.map((d) => (
            <TextField
              key={d}
              name={`count_${d}`}
              label={levels(d)}
              inputMode="numeric"
              defaultValue={v[`count_${d}`] ?? (d === 'easy' ? '5' : '0')}
              error={err(`count_${d}`)}
            />
          ))}
        </div>
        <p className="text-sm text-text-muted">{t('countsHint')}</p>
      </fieldset>
      {!locked ? (
        <div>
          <SubmitButton>{testId ? t('save') : t('create')}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

export function TestStatusPanel({
  locale,
  testId,
  status,
  canReview,
}: {
  locale: Locale;
  testId: string;
  status: string;
  canReview: boolean;
}) {
  const t = useTranslations('studio.formula');
  const [state, action] = useActionState(setTestStatus, idle);
  const button = (target: string, label: string, primary = false) => (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="testId" value={testId} />
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

'use client';

import type { Locale } from '@knj/i18n';
import { SelectField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { createTopic } from './topic-actions';

export function NewTopicForm({
  locale,
  subjects,
}: {
  locale: Locale;
  subjects: { value: string; label: string }[];
}) {
  const t = useTranslations('studio.newTopic');
  const m = useMessage();
  const [state, action] = useActionState(createTopic, idle);
  return (
    <form action={action} className="flex max-w-xl flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormAlert state={state} />
      <TextField
        name="title"
        label={t('title')}
        maxLength={150}
        defaultValue={state.values?.title}
        error={m(state.fieldErrors?.title)}
      />
      <TextField
        name="slug"
        label={t('slug')}
        hint={t('slugHint')}
        autoCapitalize="none"
        spellCheck={false}
        maxLength={80}
        defaultValue={state.values?.slug}
        error={m(state.fieldErrors?.slug)}
      />
      <SelectField
        name="subject"
        label={t('subject')}
        options={subjects}
        defaultValue={state.values?.subject}
      />
      <SubmitButton>{t('submit')}</SubmitButton>
    </form>
  );
}

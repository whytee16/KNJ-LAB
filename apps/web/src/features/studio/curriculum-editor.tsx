'use client';

import type { Locale } from '@knj/i18n';
import { Card, SelectField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { ActionForm } from '@/features/forms/action-form';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import {
  addSection,
  attachTopic,
  deleteSection,
  detachTopic,
  moveSection,
  renameSection,
} from './curriculum-actions';

interface Section {
  id: string;
  title: string;
  titleRu: string;
  titleKk: string;
  topics: { id: string; slug: string; title: string; published: boolean }[];
}

export function AddSectionForm({
  locale,
  curriculumId,
  subject,
  grade,
  quarter,
}: {
  locale: Locale;
  curriculumId: string;
  subject: string;
  grade: number;
  quarter: number;
}) {
  const t = useTranslations('studio.curriculum');
  const m = useMessage();
  const [state, action] = useActionState(addSection, idle);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {Object.entries({
        locale,
        curriculumId,
        subject,
        grade: String(grade),
        quarter: String(quarter),
      }).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <FormAlert state={state} />
      <TextField name="titleRu" label={t('titleRu')} error={m(state.fieldErrors?.titleRu)} />
      <TextField name="titleKk" label={t('titleKk')} />
      <SubmitButton variant="secondary" size="sm">
        {t('addSection')}
      </SubmitButton>
    </form>
  );
}

function RenameForm({ locale, section }: { locale: Locale; section: Section }) {
  const t = useTranslations('studio.curriculum');
  const m = useMessage();
  const [state, action] = useActionState(renameSection, idle);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="sectionId" value={section.id} />
      <FormAlert state={state} />
      <TextField
        name="titleRu"
        label={t('titleRu')}
        defaultValue={section.titleRu}
        error={m(state.fieldErrors?.titleRu)}
      />
      <TextField name="titleKk" label={t('titleKk')} defaultValue={section.titleKk} />
      <SubmitButton variant="secondary" size="sm">
        {t('save')}
      </SubmitButton>
    </form>
  );
}

export function SectionCard({
  locale,
  section,
  first,
  last,
  topicOptions,
}: {
  locale: Locale;
  section: Section;
  first: boolean;
  last: boolean;
  topicOptions: { id: string; label: string }[];
}) {
  const t = useTranslations('studio.curriculum');
  const ids = { locale, sectionId: section.id };
  const available = topicOptions.filter((o) => !section.topics.some((tp) => tp.id === o.id));
  return (
    <Card className="flex flex-col gap-4 p-4" data-testid={`section-${section.titleRu}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-semibold">{section.title}</h4>
        <div className="flex gap-2">
          {!first ? (
            <ActionForm
              action={moveSection}
              fields={{ ...ids, direction: 'up' }}
              label={t('up')}
              variant="ghost"
            />
          ) : null}
          {!last ? (
            <ActionForm
              action={moveSection}
              fields={{ ...ids, direction: 'down' }}
              label={t('down')}
              variant="ghost"
            />
          ) : null}
        </div>
      </div>
      {section.topics.length ? (
        <ul className="flex flex-col gap-2">
          {section.topics.map((tp) => (
            <li key={tp.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {tp.title}{' '}
                {!tp.published ? (
                  <span className="text-text-muted">({t('unpublished')})</span>
                ) : null}
              </span>
              <ActionForm
                action={detachTopic}
                fields={{ ...ids, topicId: tp.id }}
                label={t('detach')}
                variant="ghost"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{t('noTopics')}</p>
      )}
      {available.length ? (
        <ActionForm action={attachTopic} fields={ids} label={t('attach')}>
          <SelectField
            name="topicId"
            label={t('topic')}
            options={available.map((o) => ({ value: o.id, label: o.label }))}
          />
        </ActionForm>
      ) : null}
      <details>
        <summary className="cursor-pointer text-sm font-medium">{t('rename')}</summary>
        <div className="pt-3">
          <RenameForm locale={locale} section={section} />
        </div>
      </details>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-danger">{t('delete')}</summary>
        <div className="flex flex-col gap-2 pt-3">
          <p className="text-sm text-text-muted">{t('deleteWarning')}</p>
          <ActionForm action={deleteSection} fields={ids} label={t('deleteConfirm')} />
        </div>
      </details>
    </Card>
  );
}

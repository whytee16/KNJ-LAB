'use client';

import { DIFFICULTIES, TASK_TYPES, type TaskType } from '@knj/task-engine';
import type { Locale } from '@knj/i18n';
import { Alert, SelectField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useId, useState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { TaskFigure } from '@/features/practice/figure';
import { useMessage } from '@/features/forms/use-message';
import { saveTaskTemplate, type TaskEditorState } from './task-actions';

function Area({
  name,
  label,
  hint,
  value,
  error,
  rows = 3,
  mono = false,
}: {
  name: string;
  label: string;
  hint?: string;
  value?: string;
  error?: string;
  rows?: number;
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
        defaultValue={value}
        aria-describedby={`${id}-d`}
        className={`rounded-md border border-border bg-surface p-3 text-sm ${mono ? 'font-mono' : ''}`}
      />
      {hint || error ? (
        <p id={`${id}-d`} className={`text-sm ${error ? 'text-danger' : 'text-text-muted'}`}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

/** Problems from the 50-seed check, with samples of generated statements. */
export function ValidationReportView({
  report,
}: {
  report: NonNullable<TaskEditorState['report']>;
}) {
  const t = useTranslations('studio.task');
  return (
    <div className="flex flex-col gap-3" data-testid="validation-report">
      {report.ok ? (
        <Alert tone="success">{t('checkOk')}</Alert>
      ) : (
        <Alert tone="error">
          <p className="font-medium">{t('checkFailed')}</p>
          <ul className="mt-1 list-disc pl-5">
            {report.problems.map((p, i) => (
              <li key={i}>
                {t(`problems.${p.code}` as 'problems.spec_invalid')}
                {p.locale ? ` (${p.locale.toUpperCase()})` : ''}
                {p.detail ? `: ${p.detail}` : ''}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {report.samplesHtml.length ? (
        <div>
          <p className="text-sm font-medium">{t('samples')}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {report.samplesHtml.map((s, i) => (
              <li key={i} className="rounded-md border border-border bg-surface p-3 text-sm">
                <span className="text-xs text-text-muted">{s.locale.toUpperCase()}</span>
                <div className="prose-topic" dangerouslySetInnerHTML={{ __html: s.html }} />
                {s.figure ? <TaskFigure figure={s.figure} label={t('samples')} /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function TaskTemplateEditor({
  locale,
  templateId,
  initial,
  topics,
  locked,
}: {
  locale: Locale;
  templateId?: string;
  initial: Record<string, string>;
  topics: { value: string; label: string }[];
  locked: boolean;
}) {
  const t = useTranslations('studio.task');
  const m = useMessage();
  const [state, action] = useActionState<TaskEditorState, FormData>(saveTaskTemplate, idle);
  const v = state.values ?? initial;
  const [type, setType] = useState<TaskType>((v.type as TaskType) ?? 'number');
  const err = (f: string) => {
    const key = state.fieldErrors?.[f];
    return key ? m(key, { line: state.values?.errorLine ?? '' }) : undefined;
  };
  const choice = type === 'single_choice' || type === 'multi_choice';
  const listOptions = choice || type === 'ordering' || type === 'matching';

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {templateId ? <input type="hidden" name="templateId" value={templateId} /> : null}
      {templateId ? <input type="hidden" name="type" value={type} /> : null}
      <FormAlert state={state} />
      {state.report ? <ValidationReportView report={state.report} /> : null}

      <fieldset className="grid gap-4 md:grid-cols-3" disabled={locked}>
        <SelectField
          name="topicId"
          label={t('topic')}
          defaultValue={v.topicId}
          options={topics}
          error={err('topicId')}
        />
        <SelectField
          name={templateId ? 'typeDisplay' : 'type'}
          label={t('type')}
          value={type}
          disabled={Boolean(templateId)}
          onChange={(e) => setType(e.target.value as TaskType)}
          options={TASK_TYPES.map((x) => ({ value: x, label: t(`types.${x}`) }))}
        />
        <SelectField
          name="difficulty"
          label={t('difficulty')}
          defaultValue={v.difficulty ?? 'easy'}
          options={DIFFICULTIES.map((d) => ({ value: d, label: t(`levels.${d}`) }))}
        />
      </fieldset>

      <fieldset
        className="flex flex-col gap-4 rounded-md border border-border p-4"
        disabled={locked}
      >
        <legend className="px-1 text-sm font-semibold">{t('generation')}</legend>
        <Area
          name="params"
          label={t('params')}
          hint={t('paramsHint')}
          value={v.params}
          error={err('params')}
          mono
        />
        <Area
          name="constraints"
          label={t('constraints')}
          hint={t('constraintsHint')}
          value={v.constraints}
          rows={2}
          mono
        />
        {type === 'number' || type === 'formula' ? (
          <TextField
            name="answer"
            label={t('answer')}
            hint={type === 'number' ? t('answerHint') : t('formulaAnswerHint')}
            defaultValue={v.answer}
            error={err('answer')}
            className="font-mono"
          />
        ) : null}
        {type === 'number' ? (
          <div className="grid gap-4 sm:grid-cols-4">
            <TextField name="unit" label={t('unit')} defaultValue={v.unit} />
            <TextField
              name="decimals"
              label={t('decimals')}
              inputMode="numeric"
              defaultValue={v.decimals}
            />
            <TextField
              name="toleranceAbs"
              label={t('toleranceAbs')}
              inputMode="decimal"
              defaultValue={v.toleranceAbs}
            />
            <TextField
              name="tolerancePercent"
              label={t('tolerancePercent')}
              inputMode="decimal"
              defaultValue={v.tolerancePercent}
            />
          </div>
        ) : null}
        {type === 'formula' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="variables" label={t('variables')} defaultValue={v.variables ?? 'x'} />
            <TextField name="rangeFrom" label={t('rangeFrom')} defaultValue={v.rangeFrom} />
            <TextField name="rangeTo" label={t('rangeTo')} defaultValue={v.rangeTo} />
          </div>
        ) : null}
        {choice ? (
          <TextField
            name="correct"
            label={t('correct')}
            hint={t('correctHint')}
            defaultValue={v.correct}
            error={err('correct')}
          />
        ) : null}
      </fieldset>

      {(['ru', 'kk'] as const).map((lang) => (
        <fieldset
          key={lang}
          className="flex flex-col gap-4 rounded-md border border-border p-4"
          disabled={locked}
        >
          <legend className="px-1 text-sm font-semibold">{t(`texts.${lang}`)}</legend>
          <Area
            name={`statement_${lang}`}
            label={t('statement')}
            hint={t('statementHint')}
            value={v[`statement_${lang}`]}
            error={err('statement')}
            rows={4}
          />
          {listOptions ? (
            <Area
              name={`options_${lang}`}
              label={
                type === 'matching'
                  ? t('leftColumn')
                  : type === 'ordering'
                    ? t('orderItems')
                    : t('options')
              }
              hint={type === 'ordering' ? t('orderHint') : t('oneProLine')}
              value={v[`options_${lang}`]}
              rows={4}
            />
          ) : (
            <input type="hidden" name={`options_${lang}`} value="" />
          )}
          {type === 'matching' ? (
            <Area
              name={`matches_${lang}`}
              label={t('rightColumn')}
              hint={t('matchesHint')}
              value={v[`matches_${lang}`]}
              rows={4}
            />
          ) : (
            <input type="hidden" name={`matches_${lang}`} value="" />
          )}
          {type === 'cloze_word' ? (
            <Area
              name={`accepted_${lang}`}
              label={t('accepted')}
              hint={t('oneProLine')}
              value={v[`accepted_${lang}`]}
              rows={2}
            />
          ) : (
            <input type="hidden" name={`accepted_${lang}`} value="" />
          )}
          <Area
            name={`hints_${lang}`}
            label={t('hints')}
            hint={t('oneProLine')}
            value={v[`hints_${lang}`]}
            rows={2}
          />
          <Area
            name={`solution_${lang}`}
            label={t('solution')}
            value={v[`solution_${lang}`]}
            rows={4}
          />
        </fieldset>
      ))}

      {!locked ? (
        <div>
          <SubmitButton>{templateId ? t('saveAndCheck') : t('create')}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

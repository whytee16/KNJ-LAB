'use client';

import type { Answer } from '@knj/task-engine';
import type { Locale } from '@knj/i18n';
import { Button, cn } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { TaskFigure } from './figure';
import { useRouter } from 'next/navigation';
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { reportTaskError, submitAnswer, type AnswerState } from './actions';
import { AnswerInput } from './answer-input';
import type { RenderedPrompt } from './types';

function ReportForm({ instanceId, locale }: { instanceId: string; locale: Locale }) {
  const t = useTranslations('practice.report');
  const m = useMessage();
  const id = useId();
  const [state, action] = useActionState(reportTaskError, idle);
  if (state.status === 'success') return <FormAlert state={state} />;
  return (
    <details>
      <summary className="cursor-pointer text-sm text-text-muted">{t('open')}</summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="instanceId" value={instanceId} />
        <label htmlFor={id} className="text-sm font-medium">
          {t('label')}
        </label>
        <textarea
          id={id}
          name="message"
          rows={3}
          className="rounded-md border border-border bg-surface p-2 text-sm"
        />
        {state.fieldErrors?.message ? (
          <p className="text-sm text-danger">{m(state.fieldErrors.message)}</p>
        ) : null}
        <FormAlert state={state} />
        <SubmitButton size="sm" variant="secondary">
          {t('send')}
        </SubmitButton>
      </form>
    </details>
  );
}

/** One task: statement, answer controls, server feedback, next. */
export function TaskView({
  prompt,
  locale,
  nextLabel,
}: {
  prompt: RenderedPrompt;
  locale: Locale;
  nextLabel: string;
}) {
  const t = useTranslations('practice');
  const common = useTranslations('common');
  const router = useRouter();
  const [answer, setAnswer] = useState<Answer>('');
  const [state, action, pending] = useActionState<AnswerState, FormData>(submitAnswer, idle);
  const started = useRef(0);
  // Stable per task: a retried submission (double click, flaky network) is recognised by the server.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const onChange = useCallback((a: Answer) => setAnswer(a), []);
  const feedback = state.instanceId === prompt.instanceId ? state.feedback : undefined;
  const nextRef = useRef<HTMLButtonElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    started.current = Date.now(); // time spent counts from when the task is shown
  }, []);

  useEffect(() => {
    if (feedback) nextRef.current?.focus();
  }, [feedback]);

  return (
    <div className="flex flex-col gap-6">
      <div className="prose-topic" dangerouslySetInnerHTML={{ __html: prompt.statementHtml }} />
      {prompt.figure ? <TaskFigure figure={prompt.figure} label={t('figure')} /> : null}

      <form
        // Submitted manually (not via `action`): React would reset the form after the action and
        // erase the student's answer right when the feedback appears.
        onSubmit={(e) => {
          e.preventDefault();
          if (timeRef.current) timeRef.current.value = String(Date.now() - started.current);
          // The formula editor is a custom element: read its value at submit time.
          const field = e.currentTarget.querySelector<HTMLElement & { value: string }>(
            'math-field',
          );
          if (field && answerRef.current) answerRef.current.value = JSON.stringify(field.value);
          const data = new FormData(e.currentTarget);
          startTransition(() => action(data));
        }}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="instanceId" value={prompt.instanceId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <input type="hidden" name="answer" ref={answerRef} value={JSON.stringify(answer)} />
        <input type="hidden" name="timeMs" ref={timeRef} defaultValue="0" />
        <AnswerInput prompt={prompt} disabled={Boolean(feedback)} onChange={onChange} />
        {!feedback ? <FormAlert state={state} /> : null}
        {!feedback ? (
          <div>
            <Button type="submit" disabled={pending} aria-disabled={pending}>
              {pending ? common('pending') : t('check')}
            </Button>
          </div>
        ) : null}
      </form>

      {prompt.hintsHtml.length && !feedback ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{t('hint')}</summary>
          <div
            className="prose-topic mt-2 text-sm"
            dangerouslySetInnerHTML={{ __html: prompt.hintsHtml.join('') }}
          />
        </details>
      ) : null}

      {feedback ? (
        <section
          aria-live="polite"
          className={cn(
            'flex flex-col gap-3 rounded-lg border p-4',
            feedback.status === 'correct'
              ? 'border-success/30 bg-success/10'
              : 'border-danger/30 bg-danger/10',
          )}
        >
          <p
            className={cn(
              'text-lg font-semibold',
              feedback.status === 'correct' ? 'text-success' : 'text-danger',
            )}
          >
            {feedback.status === 'correct'
              ? `✓ ${t('correct')}`
              : feedback.score > 0
                ? `≈ ${t('partial', { percent: Math.round(feedback.score * 100) })}`
                : `✗ ${t('wrong')}`}
          </p>
          {feedback.status !== 'correct' ? (
            <div>
              <p className="text-sm font-medium">{t('rightAnswer')}</p>
              <div
                className="prose-topic"
                dangerouslySetInnerHTML={{ __html: feedback.expectedHtml }}
              />
            </div>
          ) : null}
          {feedback.solutionHtml ? (
            <details open={feedback.status !== 'correct'}>
              <summary className="cursor-pointer text-sm font-medium">{t('solution')}</summary>
              <div
                className="prose-topic mt-2"
                dangerouslySetInnerHTML={{ __html: feedback.solutionHtml }}
              />
            </details>
          ) : null}
          <div>
            <Button ref={nextRef} onClick={() => router.refresh()}>
              {nextLabel}
            </Button>
          </div>
        </section>
      ) : null}

      <ReportForm instanceId={prompt.instanceId} locale={locale} />
    </div>
  );
}

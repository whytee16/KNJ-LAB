'use client';

import type { Answer } from '@knj/task-engine';
import type { Locale } from '@knj/i18n';
import { Button, Card } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { AnswerInput } from '@/features/practice/answer-input';
import type { RenderedPrompt } from '@/features/practice/types';
import { submitTest } from './actions';

function format(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** All test items on one page; answers are sent together. In exam mode the form submits itself at 0:00. */
export function TestRunner({
  locale,
  attemptId,
  items,
  deadline,
  serverNow,
}: {
  locale: Locale;
  attemptId: string;
  items: RenderedPrompt[];
  deadline: string | null;
  serverNow: string;
}) {
  const t = useTranslations('tests');
  const formRef = useRef<HTMLFormElement>(null);
  const answersRef = useRef<HTMLInputElement>(null);
  const answers = useRef<Record<string, Answer>>({});
  const [left, setLeft] = useState<number | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (!deadline) return;
    // Server clock offset so a wrong device clock does not change the time limit.
    const offset = new Date(serverNow).getTime() - Date.now();
    const end = new Date(deadline).getTime();
    const tick = () => {
      const ms = end - (Date.now() + offset);
      setLeft(ms);
      if (ms <= 0 && !submitted.current) {
        submitted.current = true;
        formRef.current?.requestSubmit();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline, serverNow]);

  return (
    <form
      ref={formRef}
      action={submitTest}
      onSubmit={(e) => {
        for (const field of e.currentTarget.querySelectorAll<HTMLElement & { value: string }>(
          '[data-instance] math-field',
        )) {
          const id = field.closest<HTMLElement>('[data-instance]')!.dataset.instance!;
          answers.current[id] = field.value;
        }
        if (answersRef.current) answersRef.current.value = JSON.stringify(answers.current);
        submitted.current = true;
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="answers" ref={answersRef} defaultValue="{}" />
      {left !== null ? (
        <div
          className="sticky top-16 z-30 self-end rounded-md border border-border bg-surface px-4 py-2 font-mono text-lg tabular-nums shadow-card"
          role="timer"
          aria-live="off"
          aria-label={t('timeLeft')}
        >
          {format(left)}
        </div>
      ) : null}
      <ol className="flex flex-col gap-4">
        {items.map((item, i) => (
          <li key={item.instanceId} data-instance={item.instanceId}>
            <Card className="flex flex-col gap-4">
              <p className="text-sm font-medium text-text-muted">
                {t('item', { n: i + 1, total: items.length })}
              </p>
              <div
                className="prose-topic"
                dangerouslySetInnerHTML={{ __html: item.statementHtml }}
              />
              <AnswerInput
                prompt={item}
                disabled={false}
                onChange={(a) => (answers.current[item.instanceId] = a)}
              />
            </Card>
          </li>
        ))}
      </ol>
      <div>
        <Button type="submit">{t('submit')}</Button>
      </div>
      <p className="text-sm text-text-muted">{t('submitNote')}</p>
    </form>
  );
}

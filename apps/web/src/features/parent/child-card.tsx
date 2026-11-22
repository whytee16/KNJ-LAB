'use client';

import type { Locale } from '@knj/i18n';
import { Card, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Link } from '@/i18n/navigation';
import type { ChildStats } from './stats';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { deleteChild, setChildPassword } from './actions';

export interface ChildSummary {
  id: string;
  displayName: string;
  username: string;
  grade: number;
}

export function ChildCard({
  child,
  locale,
  stats,
}: {
  child: ChildSummary;
  locale: Locale;
  stats?: ChildStats;
}) {
  const t = useTranslations('parent');
  const m = useMessage();
  const [pwState, pwAction] = useActionState(setChildPassword, idle);
  const [delState, delAction] = useActionState(deleteChild, idle);

  return (
    <Card className="flex flex-col gap-4" data-testid={`child-${child.username}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{child.displayName}</h3>
        <span className="text-sm text-text-muted">
          {t('children.gradeValue', { grade: child.grade })}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
        <dt className="text-text-muted">{t('children.username')}</dt>
        <dd className="font-mono">{child.username}</dd>
      </dl>

      {stats ? (
        <div
          className="flex flex-col gap-2 rounded-md bg-surface-muted p-3 text-sm"
          data-testid={`stats-${child.username}`}
        >
          <p>{t('stats.summary', { solved: stats.solved, percent: stats.correctPercent })}</p>
          <p className="text-text-muted">{t('stats.lastWeek', { count: stats.lastWeek })}</p>
          <p className="text-text-muted" data-testid="child-labs">
            {t('stats.labs', { sessions: stats.labSessions, minutes: stats.labMinutes })}
          </p>
          {stats.results.length ? (
            <ul className="flex flex-col gap-1">
              {stats.results.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/results/${r.id}`} className="underline underline-offset-4">
                    {r.title}
                  </Link>{' '}
                  <span className="text-text-muted">
                    — {Math.round(r.max ? (100 * r.score) / r.max : 0)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <details className="rounded-md border border-border">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
          {t('setPassword.title')}
        </summary>
        <form
          action={pwAction}
          className="flex flex-col gap-3 border-t border-border p-4"
          noValidate
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="studentId" value={child.id} />
          <FormAlert state={pwState} />
          <TextField
            name="password"
            type="password"
            label={t('setPassword.password')}
            autoComplete="new-password"
            error={m(pwState.fieldErrors?.password)}
          />
          <TextField
            name="confirm"
            type="password"
            label={t('setPassword.confirm')}
            autoComplete="new-password"
            error={m(pwState.fieldErrors?.confirm)}
          />
          <SubmitButton variant="secondary">{t('setPassword.submit')}</SubmitButton>
        </form>
      </details>

      <details className="rounded-md border border-border">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-danger">
          {t('delete.title')}
        </summary>
        <form
          action={delAction}
          className="flex flex-col gap-3 border-t border-border p-4"
          noValidate
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="studentId" value={child.id} />
          <p className="text-sm text-text-muted">{t('delete.warning')}</p>
          <FormAlert state={delState} />
          <TextField
            name="confirmUsername"
            label={t('delete.confirmUsername', { username: child.username })}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            error={m(delState.fieldErrors?.confirmUsername)}
          />
          <SubmitButton variant="secondary" className="text-danger">
            {t('delete.submit')}
          </SubmitButton>
        </form>
      </details>
    </Card>
  );
}

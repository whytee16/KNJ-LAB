'use client';

import type { Locale } from '@knj/i18n';
import { SelectField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { changeRole, findUser, grantPass, revokePass, type UserSearchState } from './user-actions';

const ROLES = ['parent', 'content_manager', 'reviewer', 'admin', 'support'] as const;

export function UserRoles({ locale }: { locale: Locale }) {
  const t = useTranslations('studio.users');
  const roles = useTranslations('account.roles');
  const m = useMessage();
  const [search, find] = useActionState<UserSearchState, FormData>(findUser, idle);
  const [change, apply] = useActionState<UserSearchState, FormData>(changeRole, idle);
  const [passState, passAction] = useActionState<UserSearchState, FormData>(
    (prev, form) => grantPass({ ...prev, found: prev.found ?? search.found }, form),
    idle,
  );
  const [revokeState, revokeAction] = useActionState<UserSearchState, FormData>(
    (prev, form) =>
      revokePass({ ...prev, found: passState.found ?? prev.found ?? search.found }, form),
    idle,
  );
  const found = change.found?.id === search.found?.id ? change.found : search.found;
  const latestChildren =
    [revokeState, passState].find((s) => s.found?.id === found?.id && s.found?.children)?.found
      ?.children ?? found?.children;
  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', {
      timeZone: 'Asia/Almaty',
    });
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <form action={find} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <FormAlert state={search} />
        <TextField
          name="email"
          type="email"
          label={t('email')}
          defaultValue={search.values?.email}
          error={m(search.fieldErrors?.email)}
        />
        <SubmitButton variant="secondary">{t('find')}</SubmitButton>
      </form>
      {found ? (
        <form
          key={found.id}
          action={apply}
          className="flex flex-col gap-3 rounded-md border border-border p-4"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="userId" value={found.id} />
          <p className="text-sm">
            <span className="font-medium">{found.displayName}</span> · {found.email}
          </p>
          <FormAlert state={change} />
          {found.role === 'student' ? (
            <p className="text-sm text-text-muted">{t('studentNote')}</p>
          ) : (
            <>
              <SelectField
                name="role"
                label={t('role')}
                defaultValue={found.role}
                options={ROLES.map((r) => ({ value: r, label: roles(r) }))}
              />
              <SubmitButton>{t('apply')}</SubmitButton>
            </>
          )}
        </form>
      ) : null}
      {found && latestChildren ? (
        <section
          aria-labelledby="passes"
          className="flex flex-col gap-3 rounded-md border border-border p-4"
        >
          <h2 id="passes" className="font-semibold">
            {t('passesTitle')}
          </h2>
          <p className="text-sm text-text-muted">{t('passesNote')}</p>
          <FormAlert state={passState.status !== 'idle' ? passState : revokeState} />
          {latestChildren.length === 0 ? (
            <p className="text-sm text-text-muted">{t('noChildren')}</p>
          ) : null}
          {latestChildren.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-2 border-t border-border pt-3"
              data-testid={`passes-${c.username}`}
            >
              <p className="font-medium">
                {c.displayName}{' '}
                <span className="font-mono text-sm text-text-muted">{c.username}</span>
              </p>
              {c.passes
                .filter((p) => p.active)
                .map((p) => (
                  <form
                    key={p.id}
                    action={revokeAction}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <input type="hidden" name="passId" value={p.id} />
                    <span>{t('passUntil', { date: dateFmt(p.endsAt) })}</span>
                    <SubmitButton size="sm" variant="ghost">
                      {t('revoke')}
                    </SubmitButton>
                  </form>
                ))}
              <form
                action={passAction}
                className="grid items-end gap-2 sm:grid-cols-[100px_1fr_auto]"
              >
                <input type="hidden" name="studentId" value={c.id} />
                <TextField name="days" label={t('days')} inputMode="numeric" defaultValue="30" />
                <TextField name="reason" label={t('reason')} defaultValue={t('reasonDefault')} />
                <SubmitButton size="sm">{t('grant')}</SubmitButton>
              </form>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

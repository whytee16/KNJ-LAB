'use client';

import type { Locale } from '@knj/i18n';
import { SelectField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { changeRole, findUser, type UserSearchState } from './user-actions';

const ROLES = ['parent', 'content_manager', 'reviewer', 'admin', 'support'] as const;

export function UserRoles({ locale }: { locale: Locale }) {
  const t = useTranslations('studio.users');
  const roles = useTranslations('account.roles');
  const m = useMessage();
  const [search, find] = useActionState<UserSearchState, FormData>(findUser, idle);
  const [change, apply] = useActionState<UserSearchState, FormData>(changeRole, idle);
  const found = change.found?.id === search.found?.id ? change.found : search.found;
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
    </div>
  );
}

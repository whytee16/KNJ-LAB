'use client';

import { cn } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { idle } from '@/features/forms/form-state';
import { toggleFavorite } from './actions';

function Star({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations('reference');
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm',
        active ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-surface-muted',
      )}
    >
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
        <path
          d="m10 2 2.4 5 5.6.6-4.2 3.8 1.2 5.5L10 14.2 5 16.9l1.2-5.5L2 7.6 7.6 7z"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      {active ? t('saved') : t('save')}
    </button>
  );
}

export function FavoriteButton({ formulaId, active }: { formulaId: string; active: boolean }) {
  const [, action] = useActionState(toggleFavorite, idle);
  return (
    <form action={action}>
      <input type="hidden" name="formulaId" value={formulaId} />
      <Star active={active} />
    </form>
  );
}

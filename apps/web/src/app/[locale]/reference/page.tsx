import { Badge, Button, Card, Container, SelectField, TextField } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GRADES, isSubject, listFormulas, SUBJECTS } from '@/features/content/queries';
import { Formula } from '@/features/marketing/formula';
import { FavoriteButton } from '@/features/reference/favorite-button';
import { PublicShell } from '@/features/shell/public-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentUser } from '@/server/authz';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/reference'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as 'ru',
    namespace: 'reference',
  });
  return { title: t('title'), description: t('subtitle') };
}

export default async function ReferencePage({
  params,
  searchParams,
}: PageProps<'/[locale]/reference'>) {
  const locale = await pageLocale(params);
  const q = await searchParams;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const subject = isSubject(str(q.subject))
    ? (str(q.subject) as (typeof SUBJECTS)[number])
    : undefined;
  const gradeNum = Number(str(q.grade));
  const grade = (GRADES as readonly number[]).includes(gradeNum) ? gradeNum : undefined;
  const search = str(q.q).slice(0, 100);
  const onlyFavorites = str(q.fav) === '1';

  const user = isSupabaseConfigured() ? await getCurrentUser() : null;
  const t = await getTranslations('reference');
  const s = await getTranslations('studio.subjects');
  const learn = await getTranslations('learn');
  const formulas = await listFormulas(locale, {
    q: search,
    subject,
    grade,
    userId: user?.id,
    favoritesOf: onlyFavorites && user ? user.id : undefined,
  });

  return (
    <PublicShell>
      <Container className="py-10 md:py-14">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-text-muted">{t('subtitle')}</p>

        <form
          method="get"
          role="search"
          className="mt-8 grid items-end gap-4 md:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <TextField name="q" type="search" label={t('search')} defaultValue={search} />
          <SelectField
            name="subject"
            label={t('subject')}
            defaultValue={subject ?? ''}
            options={[
              { value: '', label: t('all') },
              ...SUBJECTS.map((x) => ({ value: x, label: s(x) })),
            ]}
          />
          <SelectField
            name="grade"
            label={t('grade')}
            defaultValue={grade ? String(grade) : ''}
            options={[
              { value: '', label: t('all') },
              ...GRADES.map((g) => ({ value: String(g), label: learn('grade', { grade: g }) })),
            ]}
          />
          <div className="flex flex-col gap-2">
            {user ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="fav"
                  value="1"
                  defaultChecked={onlyFavorites}
                  className="size-5 accent-[var(--accent)]"
                />
                {t('onlyFavorites')}
              </label>
            ) : null}
            <Button type="submit">{t('apply')}</Button>
          </div>
        </form>

        <p className="mt-6 text-sm text-text-muted" aria-live="polite">
          {t('count', { count: formulas.length })}
        </p>
        {!user ? (
          <p className="mt-1 text-sm text-text-muted">
            <Link href="/login" className="underline underline-offset-4">
              {t('loginLink')}
            </Link>{' '}
            {t('loginToSaveHint')}
          </p>
        ) : null}

        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {formulas.map((f) => (
            <li key={f.id}>
              <Card className="flex h-full flex-col gap-3" data-testid={`formula-${f.code}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold">{f.name}</h2>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={f.subject}>{s(f.subject)}</Badge>
                    <Badge>{t('grades', { from: f.gradeFrom, to: f.gradeTo })}</Badge>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md bg-surface-muted px-3 py-2 text-lg">
                  <Formula latex={f.latex} display />
                </div>
                {f.description ? <p className="text-sm text-text-muted">{f.description}</p> : null}
                {f.variables.length ? (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    {f.variables.map((v) => (
                      <div key={v.symbol} className="contents">
                        <dt>
                          <Formula latex={v.symbol} />
                        </dt>
                        <dd>
                          {v.meaning}
                          {v.unit ? `, ${v.unit}` : ''}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {user ? (
                  <div className="mt-auto">
                    <FavoriteButton formulaId={f.id} active={f.favorite} />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      </Container>
    </PublicShell>
  );
}

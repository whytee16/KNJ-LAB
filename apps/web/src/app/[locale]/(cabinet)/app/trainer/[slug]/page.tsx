import { DIFFICULTIES, type Difficulty } from '@knj/task-engine';
import { Alert, Container } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { pickLocale } from '@/features/content/queries';
import { TrainerPanel } from '@/features/practice/trainer-panel';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { requireUser } from '@/server/authz';
import { canUseLevel } from '@/server/entitlements';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/app/trainer/[slug]'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as 'ru', namespace: 'practice' });
  return { title: t('trainerTitle'), robots: { index: false } };
}

export default async function TrainerPage({
  params,
  searchParams,
}: PageProps<'/[locale]/app/trainer/[slug]'>) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const levelParam = (await searchParams).level;
  const level = (DIFFICULTIES as readonly string[]).includes(String(levelParam))
    ? (levelParam as Difficulty)
    : 'easy';
  const user = await requireUser(locale, {
    roles: ['student'],
    next: `/${locale}/app/trainer/${slug}?level=${level}`,
  });
  const t = await getTranslations('practice');

  const supabase = await createUserClient();
  const { data: topic } = await supabase
    .from('topics')
    .select('id, slug, topic_contents(locale, title)')
    .eq('slug', slug)
    .maybeSingle();
  const title = pickLocale(topic?.topic_contents, locale)?.title;
  if (!topic || !title) notFound();

  const header = (
    <div className="flex flex-col gap-1">
      <Link
        href={`/topics/${slug}`}
        className="text-sm text-text-muted underline underline-offset-4"
      >
        {title}
      </Link>
      <h1 className="type-h2">
        {t('trainerTitle')} · {t(`levels.${level}`)}
      </h1>
    </div>
  );

  if (!(await canUseLevel(user.id, level))) {
    return (
      <Container className="flex max-w-3xl flex-col gap-6 py-10">
        {header}
        <Alert tone="info">{t('locked')}</Alert>
      </Container>
    );
  }

  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-10">
      {header}
      <TrainerPanel
        studentId={user.id}
        topicId={topic.id}
        slug={slug}
        level={level}
        locale={locale}
      />
    </Container>
  );
}

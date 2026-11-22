import { labModel, parseParams } from '@knj/physics';
import { Alert, Badge, buttonVariants, Container } from '@knj/ui';
import { GameHeader, GameHints, GameInstructions, GameNavigation } from '@knj/ui/game';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { labAccess } from '@/features/labs/access';
import { LabQuestionsBlock } from '@/features/labs/lab-questions';
import { LabView } from '@/features/labs/lab-view';
import { getLab } from '@/features/labs/queries';
import { PublicShell } from '@/features/shell/public-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { createUserClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/authz';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/labs/[code]'>): Promise<Metadata> {
  const { locale, code } = await params;
  const lab = await getLab(code, locale === 'kk' ? 'kk' : 'ru');
  return lab ? { title: lab.title, description: lab.goal || undefined } : {};
}

export default async function LabPage({ params }: PageProps<'/[locale]/labs/[code]'>) {
  const locale = await pageLocale(params);
  const { code } = await params;
  const model = labModel(code);
  const lab = model ? await getLab(code, locale) : null;
  if (!model || !lab) notFound();
  const t = await getTranslations('labs');
  const s = await getTranslations('studio.subjects');
  const all = await getTranslations();
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;
  const access = await labAccess(lab, user);

  let initial = lab.defaultParams;
  if (access.student && user) {
    const supabase = await createUserClient();
    const { data: last } = await supabase
      .from('lab_sessions')
      .select('params')
      .eq('lab_id', lab.id)
      .eq('student_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last) initial = parseParams(model, last.params);
  }

  const header = (
    <GameHeader
      title={lab.title}
      subject={<Badge tone="physics">{s(lab.subject as 'physics')}</Badge>}
      meta={<span>{t('fromGrade', { grade: lab.grade })}</span>}
      badge={
        <Badge tone={lab.isFreeDemo ? 'geometry' : 'accent'}>
          {lab.isFreeDemo ? t('freeDemo') : t('withPass')}
        </Badge>
      }
      exit={
        <Link href="/labs" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          {t('toCatalog')}
        </Link>
      }
    />
  );

  const below = (
    <>
      {lab.status !== 'published' ? <Alert tone="warning">{t('draftPreview')}</Alert> : null}
      {lab.locale !== locale ? <Alert tone="info">{t('fallback')}</Alert> : null}
      <GameInstructions
        title={t('instructions')}
        goalLabel={t('goal')}
        goal={lab.goal}
        stepsLabel={t('steps')}
        steps={lab.steps}
        assumptionsLabel={t('assumptionsTitle')}
        assumptions={model.assumptions.map((key) => all(key as 'labs.title'))}
      />
      <GameHints title={t('hint')} hints={lab.hints} />
    </>
  );
  const navigation = (
    <GameNavigation>
      {lab.topics.map((topic) => (
        <Link
          key={topic.slug}
          href={`/topics/${topic.slug}`}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          {t('toTopic', { title: topic.title })}
        </Link>
      ))}
      <Link href="/labs" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        {t('toCatalog')}
      </Link>
    </GameNavigation>
  );

  return (
    <PublicShell>
      <Container className="py-8 md:py-12">
        {access.open ? (
          <LabView
            code={code}
            locale={locale}
            header={header}
            defaults={lab.defaultParams}
            initial={initial}
            canSave={access.student}
          >
            {below}
            <LabQuestionsBlock lab={lab} user={user} access={access} locale={locale} />
            {navigation}
          </LabView>
        ) : (
          <div className="flex flex-col gap-8">
            {header}
            <Alert tone="info" data-testid="lab-locked">
              <p className="font-semibold">{t('lockedTitle')}</p>
              <p className="mt-1">{t('lockedText')}</p>
            </Alert>
            {below}
            {navigation}
          </div>
        )}
      </Container>
    </PublicShell>
  );
}

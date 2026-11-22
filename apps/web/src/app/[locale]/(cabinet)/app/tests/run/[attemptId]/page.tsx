import type { TaskPrompt } from '@knj/task-engine';
import { Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { pickLocale } from '@/features/content/queries';
import { renderPrompt } from '@/features/practice/render';
import { finishTest, isPastDeadline } from '@/features/tests/attempt-server';
import { TestRunner } from '@/features/tests/test-runner';
import { pageLocale } from '@/features/shell/page-locale';
import { createUserClient } from '@/lib/supabase/server';
import { requireUser } from '@/server/authz';

export default async function TestRunPage({
  params,
}: PageProps<'/[locale]/app/tests/run/[attemptId]'>) {
  const locale = await pageLocale(params);
  const { attemptId } = await params;
  const user = await requireUser(locale, {
    roles: ['student'],
    next: `/${locale}/app/tests/run/${attemptId}`,
  });
  const supabase = await createUserClient();
  const { data: attempt } = await supabase
    .from('attempts')
    .select('id, student_id, finished_at, deadline_at, tests(mode, test_texts(locale, title))')
    .eq('id', attemptId)
    .maybeSingle();
  if (!attempt || attempt.student_id !== user.id) notFound();
  if (attempt.finished_at) redirect(`/${locale}/app/results/${attemptId}`);
  // Time is over and the browser never submitted: close the attempt with what was sent (nothing).
  if (isPastDeadline(attempt.deadline_at)) {
    await finishTest(user.id, attemptId, {});
    redirect(`/${locale}/app/results/${attemptId}`);
  }
  const { data: items } = await supabase
    .from('task_instances')
    .select('id, prompt')
    .eq('attempt_id', attemptId)
    .order('position');
  const t = await getTranslations('tests');
  const title = pickLocale(attempt.tests?.test_texts, locale)?.title ?? t('title');
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      <TestRunner
        locale={locale}
        attemptId={attemptId}
        deadline={attempt.deadline_at}
        serverNow={new Date().toISOString()}
        items={await Promise.all(
          (items ?? []).map((i) => renderPrompt(i.id, i.prompt as unknown as TaskPrompt)),
        )}
      />
    </Container>
  );
}

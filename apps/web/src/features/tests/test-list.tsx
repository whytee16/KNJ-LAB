import type { Locale } from '@knj/i18n';
import { Badge, Button, Card } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { startTest } from './actions';
import type { TestListItem } from './queries';

export async function TestList({
  tests,
  locale,
  canStart,
  hasPass,
}: {
  tests: TestListItem[];
  locale: Locale;
  canStart: boolean;
  hasPass: boolean;
}) {
  const t = await getTranslations('tests');
  const s = await getTranslations('studio.subjects');
  if (!tests.length) return <p className="text-text-muted">{t('empty')}</p>;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {tests.map((test) => (
        <li key={test.id}>
          <Card className="flex h-full flex-col gap-3" data-testid={`test-${test.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{test.title}</h3>
              <div className="flex flex-wrap gap-1">
                {test.subject ? (
                  <Badge tone={test.subject as 'algebra'}>{s(test.subject as 'algebra')}</Badge>
                ) : null}
                <Badge tone={test.paid ? 'accent' : 'geometry'}>
                  {test.paid ? t('paid') : t('free')}
                </Badge>
              </div>
            </div>
            {test.description ? (
              <p className="text-sm text-text-muted">{test.description}</p>
            ) : null}
            <p className="text-sm">
              {t('meta', { items: test.items })}
              {test.mode === 'exam' && test.minutes
                ? ` · ${t('timeLimit', { minutes: test.minutes })}`
                : ` · ${t('noLimit')}`}
            </p>
            {canStart && (!test.paid || hasPass) ? (
              <form action={startTest} className="mt-auto">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="testId" value={test.id} />
                <Button type="submit" size="sm">
                  {t('start')}
                </Button>
              </form>
            ) : canStart ? (
              <p className="mt-auto text-sm text-text-muted">{t('locked')}</p>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}

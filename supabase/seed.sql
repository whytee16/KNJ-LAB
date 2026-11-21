-- DEVELOPMENT SEED ONLY. Never applied in production (supabase db reset runs it locally / in CI).
-- Legal texts are written by a lawyer (SECURITY.md §11). Until then registration needs *some*
-- published document, so development uses clearly marked drafts (is_draft = true).

insert into public.legal_documents (type, version, locale, title, body, is_draft, published_at) values
  ('pd_processing', 'dev-0', 'ru', 'Политика конфиденциальности и согласие на обработку персональных данных',
   'ЧЕРНОВИК ДЛЯ РАЗРАБОТКИ. Это не юридический документ. Текст будет подготовлен юристом до запуска.', true, now()),
  ('pd_processing', 'dev-0', 'kk', 'Құпиялылық саясаты және дербес деректерді өңдеуге келісім',
   'ӘЗІРЛЕУГЕ АРНАЛҒАН ЖОБА. Бұл заңдық құжат емес. Мәтінді іске қосар алдында заңгер дайындайды.', true, now()),
  ('child_pd_processing', 'dev-0', 'ru', 'Согласие законного представителя на обработку персональных данных ребёнка',
   'ЧЕРНОВИК ДЛЯ РАЗРАБОТКИ. Это не юридический документ. Текст будет подготовлен юристом до запуска.', true, now()),
  ('child_pd_processing', 'dev-0', 'kk', 'Заңды өкілдің баланың дербес деректерін өңдеуге келісімі',
   'ӘЗІРЛЕУГЕ АРНАЛҒАН ЖОБА. Бұл заңдық құжат емес. Мәтінді іске қосар алдында заңгер дайындайды.', true, now());

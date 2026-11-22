-- Stage 5b.3: register the pendulum labs (models: packages/physics/src/pendulum.ts, spring.ts).
-- Texts and questions come as AI drafts through `pnpm content:import-drafts` and need review.
insert into public.labs (code, subject_code, kind, grade_from, default_params, is_free_demo, sort) values
  ('math-pendulum', 'physics', 'physics', 9, '{"l": 1, "theta0": 10, "m": 0.5, "g": 9.8}', false, 40),
  ('spring-pendulum', 'physics', 'physics', 9, '{"m": 1, "k": 40, "A": 0.1}', false, 50);

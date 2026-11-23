-- Stage 5m: register the first mechanics scenarios (packages/physics/src/scenarios, ADR-0010).
-- Texts and questions come as AI drafts through `pnpm content:import-drafts` and need review.
insert into public.labs (code, subject_code, kind, grade_from, default_params, is_free_demo, sort) values
  ('elevator-scales', 'physics', 'physics', 9, '{"m": 60, "a": 0}', false, 70),
  ('lamp-two-ropes', 'physics', 'physics', 9, '{"m": 2, "alpha1": 30, "alpha2": 30, "F": 0, "Tmax": 150}', false, 80),
  ('block-pulley', 'physics', 'physics', 9, '{"m1": 2, "m2": 1, "mu": 0.2}', false, 90),
  ('atwood', 'physics', 'physics', 9, '{"m1": 3, "m2": 1}', false, 100);

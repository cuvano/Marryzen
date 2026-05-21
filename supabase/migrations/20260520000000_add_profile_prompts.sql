-- Marryzen profile prompts (v1)
-- Adds a jsonb column for Hinge-style profile prompts.
-- Shape: jsonb array of objects, each [{ prompt: text, answer: text }, ...]
--
-- Apply via: Supabase SQL editor, or supabase db push if using migrations.

alter table public.profiles
  add column if not exists prompts jsonb default '[]'::jsonb;

comment on column public.profiles.prompts is
  'Hinge-style profile prompts. JSONB array of { prompt: string, answer: string }. Store prompt TEXT not id so prompt library evolution does not break old profiles.';

-- Optional: a quick GIN index so we can query members by prompt text patterns later.
create index if not exists profiles_prompts_gin_idx
  on public.profiles using gin (prompts);

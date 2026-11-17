-- Sever: worldwide leaderboards. Paste this whole file into the Supabase SQL Editor and press Run. Safe to run again.
--
-- One row per player per period: week = 0 is all time, any other number is that week (weeks start Monday, UTC).
-- The table itself is locked: the game can only reach it through the two functions below, so nobody can read
-- another player's id or overwrite another player's row.

create table if not exists public.scores (
  id uuid not null,
  week int not null default 0,
  name text not null,
  kills int not null default 0,
  wins int not null default 0,
  best int not null default 0,
  streak int not null default 0,
  medals int not null default 0,
  xp int not null default 0,
  horde int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (id, week)
);
create index if not exists scores_week on public.scores (week);
alter table public.scores enable row level security; -- (no policies on purpose: only the functions below touch it)
revoke all on public.scores from anon, authenticated;

-- A player sends their own totals: this week's and all time. Values only ever go up, and are capped to sane limits.
create or replace function public.submit_score(p_id uuid, p_name text, p_week int, p_wk jsonb, p_all jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  cur int := floor((extract(epoch from now()) / 86400 + 3) / 7);
  nm text := left(btrim(coalesce(p_name, '')), 14);
  n int := 0;
  s jsonb;
  cap int;
begin
  if p_id is null then return; end if;
  if nm = '' then nm := 'Ronin'; end if;
  loop
    exit when n > 1;
    if n = 0 then s := coalesce(p_all, '{}'::jsonb); cap := 50; else s := coalesce(p_wk, '{}'::jsonb); cap := 1; end if;
    if n = 0 or p_week = cur then
      insert into scores (id, week, name, kills, wins, best, streak, medals, xp, horde, updated_at) values (
        p_id, case when n = 0 then 0 else cur end, nm,
        least(greatest(coalesce((s->>'kills')::numeric::int, 0), 0), 20000 * cap),
        least(greatest(coalesce((s->>'wins')::numeric::int, 0), 0), 2000 * cap),
        least(greatest(coalesce((s->>'best')::numeric::int, 0), 0), 300),
        least(greatest(coalesce((s->>'streak')::numeric::int, 0), 0), 300),
        least(greatest(coalesce((s->>'medals')::numeric::int, 0), 0), 20000 * cap),
        least(greatest(coalesce((s->>'xp')::numeric::int, 0), 0), 500000 * cap),
        least(greatest(coalesce((s->>'horde')::numeric::int, 0), 0), 500),
        now())
      on conflict (id, week) do update set
        name = excluded.name,
        kills = greatest(scores.kills, excluded.kills),
        wins = greatest(scores.wins, excluded.wins),
        best = greatest(scores.best, excluded.best),
        streak = greatest(scores.streak, excluded.streak),
        medals = greatest(scores.medals, excluded.medals),
        xp = greatest(scores.xp, excluded.xp),
        horde = greatest(scores.horde, excluded.horde),
        updated_at = now();
    end if;
    n := n + 1;
  end loop;
end $$;

-- The top 50 of a board for a period, plus the asking player's own row and true position if they are further down.
create or replace function public.top_scores(p_board text, p_week int, p_id uuid default null)
returns table (name text, v int, me boolean, pos bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_board not in ('kills', 'wins', 'best', 'streak', 'medals', 'xp', 'horde') then raise exception 'unknown board'; end if;
  return query execute format(
    'with r as (select s.name, s.%1$I as v, s.id, row_number() over (order by s.%1$I desc, s.updated_at) as pos
                from scores s where s.week = $1 and s.%1$I > 0)
     select r.name, r.v, coalesce(r.id = $2, false), r.pos from r where r.pos <= 50 or r.id = $2 order by r.pos',
    p_board) using p_week, p_id;
end $$;

revoke all on function public.submit_score(uuid, text, int, jsonb, jsonb) from public;
revoke all on function public.top_scores(text, int, uuid) from public;
grant execute on function public.submit_score(uuid, text, int, jsonb, jsonb) to anon, authenticated;
grant execute on function public.top_scores(text, int, uuid) to anon, authenticated;

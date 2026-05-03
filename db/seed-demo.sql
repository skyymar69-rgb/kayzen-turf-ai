insert into racecourses (name, country, surface)
values
  ('ParisLongchamp', 'FR', 'Herbe'),
  ('Chantilly', 'FR', 'Herbe'),
  ('Auteuil', 'FR', 'Obstacle')
on conflict (name) do nothing;

-- Demo seed is intentionally small. Production ingestion will upsert races,
-- entries, odds snapshots and results from authorised sources.

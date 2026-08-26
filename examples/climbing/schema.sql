CREATE TABLE IF NOT EXISTS routes (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  grade  TEXT NOT NULL,
  wall   TEXT NOT NULL DEFAULT 'Main Face',
  status TEXT NOT NULL DEFAULT 'open'
         CHECK (status IN ('open', 'attempted', 'sent')),
  sort   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS log (
  id       INTEGER PRIMARY KEY,
  at       TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  route_id INTEGER NOT NULL REFERENCES routes(id),
  verb     TEXT NOT NULL CHECK (verb IN ('attempt', 'send', 'open')),
  note     TEXT NOT NULL DEFAULT ''
);

CREATE VIEW IF NOT EXISTS stats AS
SELECT
  (SELECT count(*) FROM routes) AS routes,
  (SELECT count(*) FROM routes WHERE status = 'sent') AS sent,
  (SELECT count(*) FROM routes WHERE status = 'attempted') AS attempted,
  (SELECT count(*) FROM log) AS ticks;

INSERT INTO routes (name, grade, wall, status, sort) VALUES
  ('Grain Silo',            '5.9',   'Main Face', 'sent',      1),
  ('Evening Light',         '5.8',   'Main Face', 'sent',      2),
  ('Chalk Ghost',           '5.10a', 'Main Face', 'sent',      3),
  ('Farmer''s Daughter',    '5.10b', 'Main Face', 'attempted', 4),
  ('The Arete That Wasn''t','5.10d', 'Main Face', 'open',      5),
  ('Dust to Dust',          '5.11a', 'Arete',     'attempted', 6),
  ('Redline',               '5.11b', 'Arete',     'sent',      7),
  ('Corrugated',            '5.11c', 'Arete',     'open',      8),
  ('Pocket Calendar',       '5.12a', 'Roof',      'attempted', 9),
  ('Bolt Tax',              '5.12b', 'Roof',      'open',      10),
  ('Last Bus Home',         '5.13a', 'Roof',      'open',      11);

INSERT INTO log (at, route_id, verb, note) VALUES
  (datetime('now', 'localtime', '-2 days'), 1, 'send', 'soft for the grade'),
  (datetime('now', 'localtime', '-2 days'), 2, 'send', ''),
  (datetime('now', 'localtime', '-1 days'), 3, 'send', 'dew on the crimps'),
  (datetime('now', 'localtime', '-1 days'), 4, 'attempt', 'blew the crux slap'),
  (datetime('now', 'localtime', '-4 hours'), 7, 'send', ''),
  (datetime('now', 'localtime', '-3 hours'), 9, 'attempt', 'one hang');

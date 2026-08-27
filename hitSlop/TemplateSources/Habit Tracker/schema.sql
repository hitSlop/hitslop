CREATE TABLE habit_settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  title      TEXT NOT NULL,
  week_start TEXT NOT NULL CHECK (date(week_start) IS NOT NULL)
);

CREATE TABLE habits (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  icon     TEXT NOT NULL DEFAULT '✓',
  position INTEGER NOT NULL
);

CREATE TABLE habit_checks (
  habit_id  INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  day       TEXT NOT NULL CHECK (date(day) IS NOT NULL),
  completed INTEGER NOT NULL DEFAULT 1 CHECK (completed IN (0, 1)),
  PRIMARY KEY (habit_id, day)
);

CREATE VIEW habit_week AS
SELECT h.id,
       h.name,
       h.icon,
       h.position,
       date(s.week_start, '+0 days') AS day_0,
       date(s.week_start, '+1 days') AS day_1,
       date(s.week_start, '+2 days') AS day_2,
       date(s.week_start, '+3 days') AS day_3,
       date(s.week_start, '+4 days') AS day_4,
       date(s.week_start, '+5 days') AS day_5,
       date(s.week_start, '+6 days') AS day_6,
       max(CASE WHEN c.day = date(s.week_start, '+0 days') THEN c.completed ELSE 0 END) AS done_0,
       max(CASE WHEN c.day = date(s.week_start, '+1 days') THEN c.completed ELSE 0 END) AS done_1,
       max(CASE WHEN c.day = date(s.week_start, '+2 days') THEN c.completed ELSE 0 END) AS done_2,
       max(CASE WHEN c.day = date(s.week_start, '+3 days') THEN c.completed ELSE 0 END) AS done_3,
       max(CASE WHEN c.day = date(s.week_start, '+4 days') THEN c.completed ELSE 0 END) AS done_4,
       max(CASE WHEN c.day = date(s.week_start, '+5 days') THEN c.completed ELSE 0 END) AS done_5,
       max(CASE WHEN c.day = date(s.week_start, '+6 days') THEN c.completed ELSE 0 END) AS done_6,
       sum(CASE WHEN c.completed = 1 THEN 1 ELSE 0 END) AS completed,
       7 AS possible
FROM habits h
JOIN habit_settings s ON s.id = 1
LEFT JOIN habit_checks c ON c.habit_id = h.id
 AND c.day >= s.week_start
 AND c.day < date(s.week_start, '+7 days')
GROUP BY h.id, s.week_start;

INSERT INTO habit_settings(id, title, week_start)
VALUES (1, 'Habit Tracker', date('now', '-' || ((CAST(strftime('%w','now') AS INTEGER) + 6) % 7) || ' days'));

INSERT INTO habits(name, icon, position) VALUES
  ('Exercise', '↗', 1),
  ('Reading', '◫', 2),
  ('Meditation', '○', 3),
  ('Journaling', '✎', 4);

INSERT INTO habit_checks(habit_id, day, completed)
SELECT h.id, date(s.week_start, '+' || d.offset || ' days'), 1
FROM habits h
CROSS JOIN habit_settings s
JOIN (SELECT 0 offset UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) d
WHERE (h.position = 1 AND d.offset IN (0,1,2))
   OR (h.position = 2 AND d.offset IN (0,1,2,3,4))
   OR (h.position = 3 AND d.offset IN (0,2))
   OR (h.position = 4 AND d.offset IN (0,1,2,3));

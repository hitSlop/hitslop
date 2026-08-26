# Silo Wall

A tick list for a sandstone crag. The file is the log.

## Tables

- `routes(id, name, grade, wall, status, sort)`
  - `status` is `open` | `attempted` | `sent`
- `log(id, at, route_id, verb, note)`
  - `verb` is `attempt` | `send` | `open`
- `stats` view — `routes`, `sent`, `attempted`, `ticks`

## Useful queries

```sql
SELECT name, grade, status FROM routes ORDER BY sort;
SELECT * FROM stats;
SELECT r.name, l.verb, l.at
  FROM log l JOIN routes r ON r.id = l.route_id
 ORDER BY l.at DESC LIMIT 20;
```

## Useful writes

```sql
UPDATE routes SET status = 'sent' WHERE name = 'Bolt Tax';
INSERT INTO log (route_id, verb, note)
  VALUES ((SELECT id FROM routes WHERE name = 'Bolt Tax'), 'send', 'finally');

INSERT INTO routes (name, grade, wall, status, sort)
  VALUES ('New Line', '5.11a', 'Main Face', 'open', 99);
```

Clicking a ring in the UI cycles open → attempted → sent → open and appends a `log` row.

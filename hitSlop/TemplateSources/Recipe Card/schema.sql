CREATE TABLE recipe (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  title            TEXT NOT NULL,
  subtitle         TEXT NOT NULL DEFAULT '',
  prep_minutes     INTEGER NOT NULL DEFAULT 0 CHECK (prep_minutes >= 0),
  cook_minutes     INTEGER NOT NULL DEFAULT 0 CHECK (cook_minutes >= 0),
  servings         INTEGER NOT NULL DEFAULT 1 CHECK (servings > 0),
  tip              TEXT NOT NULL DEFAULT '',
  photo_asset_path TEXT
);

CREATE TABLE ingredients (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  ready    INTEGER NOT NULL DEFAULT 0 CHECK (ready IN (0, 1)),
  position INTEGER NOT NULL
);

CREATE TABLE steps (
  id       INTEGER PRIMARY KEY,
  title    TEXT NOT NULL,
  detail   TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL
);

INSERT INTO recipe VALUES (1, 'Pasta Carbonara', 'Classic Roman pasta with eggs, cheese, and guanciale', 10, 20, 4, 'Never add cream to a real carbonara.', NULL);
INSERT INTO ingredients(name,ready,position) VALUES
 ('400g spaghetti',0,1),('200g guanciale',0,2),('4 egg yolks',1,3),('100g Pecorino Romano',1,4),('Black pepper',1,5);
INSERT INTO steps(title,detail,position) VALUES
 ('Boil water','Bring a large pot of salted water to a rolling boil.',1),
 ('Cook guanciale','Start in a cold pan and render until crispy.',2),
 ('Mix eggs and cheese','Whisk yolks and grated Pecorino until thick.',3),
 ('Cook pasta','Stop 1 minute short of al dente.',4),
 ('Combine','Toss off heat with guanciale, then work in the egg mixture quickly.',5);

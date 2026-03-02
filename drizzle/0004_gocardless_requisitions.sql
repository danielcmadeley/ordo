CREATE TABLE gocardless_requisitions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  institution_id text NOT NULL,
  institution_name text,
  account_ids text,
  status text NOT NULL,
  created_at integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  updated_at integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade
);
CREATE UNIQUE INDEX gocardless_requisitions_user_id_unique ON gocardless_requisitions (user_id);

create table projects (
  id text primary key not null check (length(trim(id)) > 0),
  directory text not null unique check (length(trim(directory)) > 0),
  name text not null check (length(trim(name)) > 0),
  last_opened integer not null
);

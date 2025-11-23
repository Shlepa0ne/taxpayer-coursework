CREATE TABLE IF NOT EXISTS public.taxpayer_auth (
  inn varchar(32) PRIMARY KEY,
  password_hash varchar(512) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.worker_auth (
  inn varchar(32) PRIMARY KEY,
  password_hash varchar(512) NOT NULL
);
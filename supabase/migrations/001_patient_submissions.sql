create table if not exists patient_submissions (
  session_id text primary key,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth text not null,
  gender text not null,
  phone text not null,
  email text not null,
  address text not null,
  preferred_language text not null,
  nationality text not null,
  emergency_contact_name text,
  emergency_contact_relationship text,
  religion text,
  submitted_at timestamptz not null default now()
);

alter table patient_submissions enable row level security;

create policy "public insert" on patient_submissions
  for insert
  to anon
  with check (true);

create policy "public read" on patient_submissions
  for select
  to anon
  using (true);

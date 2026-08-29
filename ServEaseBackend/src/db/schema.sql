-- ServEase database schema for Supabase.
-- Run this once in the Supabase dashboard: SQL Editor -> New query.
--
-- All data access goes through the backend using the service role key,
-- which bypasses Row Level Security. RLS stays enabled by default so the
-- anon/public keys cannot read any data directly.

create extension if not exists citext;

-- Users (customers, service providers, admins) --------------------------

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email citext not null unique,
  phone text not null unique,
  password_hash text not null,
  address text,
  role text not null default 'customer'
    check (role in ('customer', 'service_provider', 'admin')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended')),
  valid_id_url text,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One-time passcodes (phone verification, password reset) ---------------

create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  purpose text not null check (purpose in ('verify_phone', 'reset_password')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists otp_codes_phone_purpose_idx
  on public.otp_codes (phone, purpose, created_at desc);

-- Service catalog --------------------------------------------------------

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null
    references public.service_categories (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

-- Service provider applications ------------------------------------------

create table if not exists public.provider_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date not null,
  gender text not null,
  email citext not null,
  phone text not null,
  address text not null,
  categories text[] not null default '{}',
  services text[] not null default '{}',
  other_services text,
  years_experience integer not null default 0,
  offers_home_service boolean not null default false,
  valid_id_url text,
  selfie_url text,
  supporting_docs_url text,
  status text not null default 'pending'
    check (status in ('pending', 'under_review', 'approved', 'rejected')),
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists provider_applications_user_idx
  on public.provider_applications (user_id, created_at desc);

-- Service requests (customer bookings / repairs) ---------------------------

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users (id) on delete cascade,
  provider_id uuid references public.users (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_requests_customer_idx
  on public.service_requests (customer_id, created_at desc);
create index if not exists service_requests_provider_idx
  on public.service_requests (provider_id, created_at desc);

-- Notifications --------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- Keep updated_at current -------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists provider_applications_set_updated_at on public.provider_applications;
create trigger provider_applications_set_updated_at
  before update on public.provider_applications
  for each row execute function public.set_updated_at();

drop trigger if exists service_requests_set_updated_at on public.service_requests;
create trigger service_requests_set_updated_at
  before update on public.service_requests
  for each row execute function public.set_updated_at();

-- Seed the catalog (matches the mobile application flow) ------------------

insert into public.service_categories (name, sort_order) values
  ('IT-RELATED DEVICE REPAIR', 1),
  ('PHONE REPAIR', 2),
  ('AUTOMOTIVE SERVICES', 3),
  ('HOME REPAIR SERVICES', 4)
on conflict (name) do nothing;

insert into public.services (category_id, name)
select c.id, seed.service_name
from public.service_categories c
join (values
  ('IT-RELATED DEVICE REPAIR', 'COMPUTER / LAPTOP FORMATTING'),
  ('IT-RELATED DEVICE REPAIR', 'OS INSTALLATION & UPGRADE'),
  ('IT-RELATED DEVICE REPAIR', 'VIRUS & MALWARE REMOVAL'),
  ('IT-RELATED DEVICE REPAIR', 'HARDWARE TROUBLESHOOTING'),
  ('PHONE REPAIR', 'SCREEN REPLACEMENT'),
  ('PHONE REPAIR', 'BATTERY REPLACEMENT'),
  ('PHONE REPAIR', 'SOFTWARE ISSUES'),
  ('PHONE REPAIR', 'WATER DAMAGE REPAIR'),
  ('AUTOMOTIVE SERVICES', 'OIL CHANGE & PMS'),
  ('AUTOMOTIVE SERVICES', 'BRAKE INSPECTION'),
  ('AUTOMOTIVE SERVICES', 'ENGINE DIAGNOSTICS'),
  ('AUTOMOTIVE SERVICES', 'TIRE SERVICES'),
  ('HOME REPAIR SERVICES', 'PLUMBING'),
  ('HOME REPAIR SERVICES', 'ELECTRICAL REPAIR'),
  ('HOME REPAIR SERVICES', 'CARPENTRY'),
  ('HOME REPAIR SERVICES', 'APPLIANCE REPAIR')
) as seed (category_name, service_name) on c.name = seed.category_name
on conflict do nothing;

-- Private storage bucket for verification documents -----------------------

insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

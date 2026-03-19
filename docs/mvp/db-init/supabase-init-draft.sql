-- Supabase / PostgreSQL 初始化草案
-- 用途：
-- 1. 作为 CloudBase 备选方案
-- 2. 在需要 SQL 化管理和更强关系查询时直接使用
-- 3. 字段设计对齐 docs/mvp/02-data-model.md

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  external_auth_id text,
  open_id text,
  nickname text not null,
  avatar_url text,
  mobile text,
  role text not null default 'user',
  status text not null default 'active',
  default_city_code text,
  default_district_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_check check (role in ('user', 'admin', 'customer_service')),
  constraint users_status_check check (status in ('active', 'disabled'))
);

create unique index if not exists idx_users_open_id on public.users(open_id);
create index if not exists idx_users_status on public.users(status);

create table if not exists public.districts (
  code text primary key,
  name text not null,
  city_code text not null,
  city_name text not null,
  province_code text not null,
  province_name text not null,
  is_active boolean not null default true,
  sort_order integer default 0
);

create index if not exists idx_districts_city_active
  on public.districts(city_code, is_active);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id),
  title text not null,
  description text not null,
  price numeric(10,2) not null default 0,
  district_code text not null references public.districts(code),
  district_name text not null,
  city_code text not null,
  city_name text not null,
  status text not null default 'pending_review',
  review_status text not null default 'pending',
  reject_reason text,
  cover_image_url text,
  image_count integer not null default 0,
  view_count integer not null default 0,
  contact_count integer not null default 0,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_status_check check (
    status in ('draft', 'pending_review', 'approved', 'rejected', 'removed', 'sold')
  ),
  constraint listings_review_status_check check (
    review_status in ('pending', 'approved', 'rejected')
  )
);

create index if not exists idx_listings_status_district_created
  on public.listings(status, district_code, created_at desc);
create index if not exists idx_listings_seller_created
  on public.listings(seller_id, created_at desc);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_listing_images_listing_sort
  on public.listing_images(listing_id, sort_order);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.users(id),
  seller_id uuid not null references public.users(id),
  status text not null default 'active',
  last_message_text text,
  last_message_at timestamptz,
  buyer_unread_count integer not null default 0,
  seller_unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_status_check check (status in ('active', 'closed'))
);

create unique index if not exists idx_conversations_unique_pair
  on public.conversations(listing_id, buyer_id);
create index if not exists idx_conversations_buyer_updated
  on public.conversations(buyer_id, updated_at desc);
create index if not exists idx_conversations_seller_updated
  on public.conversations(seller_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  receiver_id uuid not null references public.users(id),
  content text not null,
  message_type text not null default 'text',
  read_status text not null default 'unread',
  created_at timestamptz not null default now(),
  constraint messages_type_check check (message_type in ('text')),
  constraint messages_read_status_check check (read_status in ('unread', 'read'))
);

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at asc);
create index if not exists idx_messages_receiver_read
  on public.messages(receiver_id, read_status);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  category text not null,
  content text not null,
  contact_info text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint feedback_category_check check (
    category in ('bug', 'suggestion', 'complaint', 'other')
  ),
  constraint feedback_status_check check (
    status in ('new', 'processing', 'closed')
  )
);

create index if not exists idx_feedback_status_created
  on public.feedback(status, created_at desc);

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.users(id),
  target_type text not null,
  target_id text not null,
  action text not null,
  action_note text,
  created_at timestamptz not null default now(),
  constraint admin_actions_target_type_check check (
    target_type in ('listing', 'user', 'feedback')
  ),
  constraint admin_actions_action_check check (
    action in ('approve', 'reject', 'remove', 'disable', 'close_feedback')
  )
);

create index if not exists idx_admin_actions_target
  on public.admin_actions(target_type, target_id);
create index if not exists idx_admin_actions_admin_created
  on public.admin_actions(admin_user_id, created_at desc);

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_listings_updated_at on public.listings;
create trigger trg_listings_updated_at
before update on public.listings
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row execute procedure public.set_updated_at();

insert into public.districts (
  code,
  name,
  city_code,
  city_name,
  province_code,
  province_name,
  is_active,
  sort_order
)
values
  ('330106', '西湖区', '330100', '杭州市', '330000', '浙江省', true, 1),
  ('330105', '拱墅区', '330100', '杭州市', '330000', '浙江省', true, 2),
  ('330110', '余杭区', '330100', '杭州市', '330000', '浙江省', true, 3),
  ('420111', '洪山区', '420100', '武汉市', '420000', '湖北省', true, 4),
  ('420106', '武昌区', '420100', '武汉市', '420000', '湖北省', true, 5),
  ('420103', '江汉区', '420100', '武汉市', '420000', '湖北省', true, 6)
on conflict (code) do update set
  name = excluded.name,
  city_code = excluded.city_code,
  city_name = excluded.city_name,
  province_code = excluded.province_code,
  province_name = excluded.province_name,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

-- 如需初始化管理员，可在拿到首个用户 ID 后执行：
-- update public.users
-- set role = 'admin'
-- where id = '<admin-user-id>';

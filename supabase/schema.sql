-- Juvio database schema for Supabase
-- Run this in Supabase SQL Editor before using the app.
-- Free tier: 500 MB database, 2 GB bandwidth/month.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Workspaces (tim)
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz default now()
);

-- 2. Workspace members (siapa saja anggota dan peran mereka)
create table workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);

-- 3. Pages (halaman, bisa nested via parent_id)
create table pages (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_id uuid references pages(id) on delete cascade,
  title text default '',
  icon text,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Blocks (blok dalam halaman)
create table blocks (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid not null references pages(id) on delete cascade,
  parent_block_id uuid references blocks(id) on delete cascade,
  type text not null default 'paragraph',
  html text default '',
  order_index integer default 0,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ----------------------------------------------------------------
-- Row Level Security (RLS): user hanya bisa akses workspace yang diikutinya
-- ----------------------------------------------------------------

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table pages enable row level security;
alter table blocks enable row level security;

-- Workspaces: owner atau anggota bisa baca/tulis
create policy "workspace members can access workspace"
  on workspaces for all
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = workspaces.id
        and workspace_members.user_id = auth.uid()
    )
  );

-- Workspace members: hanya jika user adalah anggota workspace terkait
create policy "workspace members can access members"
  on workspace_members for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Pages: bisa diakses jika user adalah anggota workspace halaman
create policy "pages accessible via workspace membership"
  on pages for all
  using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = pages.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );

-- Blocks: bisa diakses jika user adalah anggota workspace milik halaman blok
create policy "blocks accessible via page workspace membership"
  on blocks for all
  using (
    exists (
      select 1 from pages p
      join workspace_members wm on wm.workspace_id = p.workspace_id
      where p.id = blocks.page_id
        and wm.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- Indexes untuk performa query
-- ----------------------------------------------------------------

create index idx_pages_workspace_id on pages(workspace_id);
create index idx_pages_parent_id on pages(parent_id);
create index idx_blocks_page_id on blocks(page_id);
create index idx_blocks_parent_block_id on blocks(parent_block_id);
create index idx_workspace_members_user_id on workspace_members(user_id);
create index idx_workspace_members_workspace_id on workspace_members(workspace_id);

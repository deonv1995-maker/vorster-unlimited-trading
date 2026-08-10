-- Vorster Unlimited shared-data backend (V9.0.41)
-- Run once in a Supabase project's SQL editor.
-- Browser clients use only the publishable/anon key + authenticated user JWT.

create extension if not exists pgcrypto;

create table if not exists public.vu_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.vu_workspace_members (
  workspace_id uuid not null references public.vu_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists public.vu_records (
  workspace_id uuid not null references public.vu_workspaces(id) on delete cascade,
  store_name text not null,
  record_id text not null,
  payload jsonb,
  deleted boolean not null default false,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (workspace_id,store_name,record_id)
);
create index if not exists vu_records_workspace_updated_idx on public.vu_records(workspace_id,updated_at);

alter table public.vu_workspaces enable row level security;
alter table public.vu_workspace_members enable row level security;
alter table public.vu_records enable row level security;

revoke all on public.vu_workspaces from anon;
revoke all on public.vu_workspace_members from anon;
revoke all on public.vu_records from anon;
grant select on public.vu_workspaces to authenticated;
grant select on public.vu_workspace_members to authenticated;
grant select on public.vu_records to authenticated;

create or replace function public.vu_is_member(p_workspace uuid)
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists(select 1 from public.vu_workspace_members m where m.workspace_id=p_workspace and m.user_id=auth.uid());
$$;

create policy "members can view workspaces" on public.vu_workspaces
for select to authenticated
using (public.vu_is_member(id));

create policy "members can view membership" on public.vu_workspace_members
for select to authenticated
using (public.vu_is_member(workspace_id));

create policy "members can read shared records" on public.vu_records
for select to authenticated
using (public.vu_is_member(workspace_id));

create or replace function public.vu_create_workspace(p_name text)
returns uuid
language plpgsql security definer
set search_path=public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.vu_workspaces(name,created_by) values (coalesce(nullif(trim(p_name),''),'Vorster Unlimited'),auth.uid()) returning id into v_id;
  insert into public.vu_workspace_members(workspace_id,user_id,role) values(v_id,auth.uid(),'owner');
  return v_id;
end;
$$;

grant execute on function public.vu_create_workspace(text) to authenticated;

create or replace function public.vu_add_member_by_email(p_workspace uuid,p_email text)
returns uuid
language plpgsql security definer
set search_path=public,auth
as $$
declare v_user uuid;
begin
  if not exists(select 1 from public.vu_workspace_members where workspace_id=p_workspace and user_id=auth.uid() and role='owner') then
    raise exception 'Workspace owner required';
  end if;
  select u.id into v_user from auth.users u where lower(u.email)=lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'That email must create/sign in to an account first'; end if;
  insert into public.vu_workspace_members(workspace_id,user_id,role) values(p_workspace,v_user,'member') on conflict do nothing;
  return v_user;
end;
$$;

grant execute on function public.vu_add_member_by_email(uuid,text) to authenticated;

create or replace function public.vu_apply_record(
  p_workspace uuid,
  p_store text,
  p_record_id text,
  p_payload jsonb,
  p_deleted boolean,
  p_expected_revision bigint default 0
)
returns table(applied boolean, conflict boolean, revision bigint, updated_at timestamptz, payload jsonb, deleted boolean)
language plpgsql security definer
set search_path=public
as $$
declare v_row public.vu_records%rowtype;
begin
  if not public.vu_is_member(p_workspace) then raise exception 'Workspace membership required'; end if;
  select * into v_row from public.vu_records
    where workspace_id=p_workspace and store_name=p_store and record_id=p_record_id
    for update;

  if not found then
    if coalesce(p_expected_revision,0) <> 0 then
      return query select false,true,0::bigint,null::timestamptz,null::jsonb,false;
      return;
    end if;
    insert into public.vu_records(workspace_id,store_name,record_id,payload,deleted,revision,updated_at,updated_by)
      values(p_workspace,p_store,p_record_id,p_payload,coalesce(p_deleted,false),1,now(),auth.uid())
      returning * into v_row;
    return query select true,false,v_row.revision,v_row.updated_at,v_row.payload,v_row.deleted;
    return;
  end if;

  if v_row.revision <> coalesce(p_expected_revision,0) then
    return query select false,true,v_row.revision,v_row.updated_at,v_row.payload,v_row.deleted;
    return;
  end if;

  update public.vu_records set
    payload=p_payload,
    deleted=coalesce(p_deleted,false),
    revision=v_row.revision+1,
    updated_at=now(),
    updated_by=auth.uid()
  where workspace_id=p_workspace and store_name=p_store and record_id=p_record_id
  returning * into v_row;
  return query select true,false,v_row.revision,v_row.updated_at,v_row.payload,v_row.deleted;
end;
$$;

grant execute on function public.vu_apply_record(uuid,text,text,jsonb,boolean,bigint) to authenticated;

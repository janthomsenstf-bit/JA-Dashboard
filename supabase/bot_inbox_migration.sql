-- ============================================================================
-- bot_inbox – Telegram Bot → Dashboard Inbox
-- Einmalig im Supabase SQL-Editor ausführen
-- ============================================================================

create table if not exists bot_inbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  raw_text text not null,
  intent text,
  client_id text,
  client_name text,
  draft jsonb,
  status text default 'neu',
  confirmed_at timestamptz,
  telegram_message_id text
);

-- Index für schnelles Polling (status = 'neu')
create index if not exists idx_bot_inbox_status on bot_inbox (status) where status = 'neu';

-- Row Level Security aktivieren
alter table bot_inbox enable row level security;

-- Policy: authentifizierte User dürfen alles (Single-User-System)
create policy "Authenticated users full access" on bot_inbox
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

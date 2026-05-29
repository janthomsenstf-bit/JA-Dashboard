-- ============================================================================
-- bot_inbox – Status-Index erweitern
-- Einmalig im Supabase SQL-Editor ausführen (nach bot_inbox_migration.sql)
-- ============================================================================

-- Alten partiellen Index entfernen (nur status='neu')
drop index if exists idx_bot_inbox_status;

-- Neuer Index auf die status-Spalte (alle Werte)
create index if not exists idx_bot_inbox_status on bot_inbox (status);

-- Sicherstellen dass die service_role auch schreiben kann (für Webhook)
-- (sollte bereits existieren, hier zur Sicherheit)
create policy if not exists "Service role full access" on bot_inbox
  for all
  using (true)
  with check (true);

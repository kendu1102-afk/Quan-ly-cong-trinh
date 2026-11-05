#!/usr/bin/env bash
# Dựng môi trường thử: PostgreSQL + PostgREST + cổng giả lập; ứng dụng build trỏ về cổng đó.
set -euo pipefail
R=$(cd "$(dirname "$0")/../.." && pwd); D=$R/tests/e2e; PGBIN=/usr/lib/postgresql/16/bin
W=${E2E_DIR:-/tmp/e2e-run}; rm -rf "$W"; mkdir -p "$W"; chown postgres "$W"
su postgres -c "$PGBIN/initdb -D $W/pg -A trust >/dev/null"
echo "host all authenticator 127.0.0.1/32 trust" >> $W/pg/pg_hba.conf
su postgres -c "$PGBIN/pg_ctl -D $W/pg -o '-p 54399 -k /tmp' -l $W/pg.log -w start >/dev/null"
P="psql -h /tmp -p 54399 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create database t"; P="$P -d t"
$P -f "$R/supabase/tests/shim.sql"
$P -c "alter table auth.users add column pw text; create role authenticator login noinherit; grant anon, authenticated to authenticator;"
$P -f "$R/supabase/migrations/01_schema.sql"
$P -f "$R/supabase/migrations/03_danh_muc_vat_tu.sql"
$P -f "$R/supabase/migrations/04_thong_bao_day_va_sao_luu_tu_dong.sql"
cat > $W/pgrst.conf <<CONF
db-uri = "postgres://authenticator@127.0.0.1:54399/t"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "test-secret-test-secret-test-secret-1234"
server-port = 3000
CONF
nohup $D/.postgrest-bin $W/pgrst.conf > $W/pgrst.log 2>&1 &
cd $R/app && VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=anon npm run build >/dev/null
DIST=$R/app/dist nohup node $D/gateway.mjs > $W/gw.log 2>&1 &
sleep 3; curl -s -m 5 localhost:54321/rest/v1/ -H "apikey: x" | head -c 60; echo; echo INFRA-OK

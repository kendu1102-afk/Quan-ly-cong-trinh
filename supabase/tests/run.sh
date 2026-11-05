#!/usr/bin/env bash
# Chạy: bash supabase/tests/run.sh   (cần PostgreSQL 16 cài sẵn)
set -euo pipefail
D=$(cd "$(dirname "$0")" && pwd)
PGBIN=/usr/lib/postgresql/16/bin
DATA=$(mktemp -d); chown postgres "$DATA"; chmod 700 "$DATA"
su postgres -c "$PGBIN/initdb -D $DATA -A trust >/dev/null"
su postgres -c "$PGBIN/pg_ctl -D $DATA -o '-p 54399 -k /tmp' -l $DATA/log -w start >/dev/null"
trap "su postgres -c '$PGBIN/pg_ctl -D $DATA -m immediate stop >/dev/null'; rm -rf $DATA" EXIT
P="psql -h /tmp -p 54399 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create database t" ; P="$P -d t"
$P -f "$D/shim.sql" && $P -f "$D/../migrations/01_schema.sql"
$P -t -f "$D/test.sql" 2>&1 | grep -E "NOTICE|ERROR|CONTEXT|TẤT CẢ" | sed -E "s/^psql:[^ ]+ //"

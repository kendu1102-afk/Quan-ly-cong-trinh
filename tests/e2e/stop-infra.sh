#!/usr/bin/env bash
pkill -f .postgrest-bin; pkill -f gateway.mjs
W=${E2E_DIR:-/tmp/e2e-run}; su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $W/pg -m immediate stop" >/dev/null 2>&1 || true

#!/usr/bin/env bash
# Creates the admin and the players in Supabase Auth (admin API). Run ONCE from your machine.
# Secrets come from the environment, never from the repo:
#   SUPABASE_URL        https://<ref>.supabase.co
#   SERVICE_ROLE_KEY    Project Settings -> API Keys -> service_role (secret)
#   DEFAULT_PASS        initial password for players (they must change it on first login)
#   ADMIN_EMAIL         real email of the admin
#   ADMIN_PASS          admin password (any; Supabase enforces its own minimum, 6 by default)
#   ADMIN_NAME          admin display name
# Values can also live in supabase/.env (git-ignored; copy supabase/.env.example). Real env vars win over the file.
# Usage: ./seed-users.sh jugadores.txt     (one player name per line, admin NOT included)
set -euo pipefail

ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r linea || [ -n "$linea" ]; do
    case "$linea" in ''|'#'*) continue ;; esac
    clave="${linea%%=*}"; valor="${linea#*=}"
    valor="${valor%\"}"; valor="${valor#\"}"
    # Only fill what is not already set in the environment; no shell evaluation of the file.
    if [ -z "${!clave:-}" ]; then export "$clave=$valor"; fi
  done < "$ENV_FILE"
fi

: "${SUPABASE_URL:?}" "${SERVICE_ROLE_KEY:?}" "${DEFAULT_PASS:?}" "${ADMIN_EMAIL:?}" "${ADMIN_PASS:?}" "${ADMIN_NAME:?}"
FILE="${1:?usage: $0 jugadores.txt}"
for b in curl jq openssl; do command -v "$b" >/dev/null || { echo "missing: $b" >&2; exit 1; }; done

# New-format secret keys (sb_secret_...) are not JWTs: they go only in the apikey header.
# Legacy service_role keys are JWTs and also go in Authorization.
H=(-H "apikey: $SERVICE_ROLE_KEY" -H "Content-Type: application/json")
case "$SERVICE_ROLE_KEY" in sb_secret_*) ;; *) H+=(-H "Authorization: Bearer $SERVICE_ROLE_KEY") ;; esac
case "$SERVICE_ROLE_KEY" in
  sb_publishable_*) echo "SERVICE_ROLE_KEY is the PUBLISHABLE key. Use the secret / service_role key (Project Settings -> API Keys)." >&2; exit 1 ;;
esac

OUT="$(mktemp)"; trap 'rm -f "$OUT"' EXIT
# api METHOD PATH [curl args...] -> prints the body; on HTTP error prints status + body to stderr and exits.
api() {
  local m="$1" p="$2"; shift 2
  local code
  code=$(curl -sS -o "$OUT" -w '%{http_code}' "${H[@]}" -X "$m" "$SUPABASE_URL$p" "$@") || { echo "network error calling $p" >&2; exit 1; }
  case "$code" in
    2*) cat "$OUT" ;;
    *)  echo "HTTP $code on $m $p: $(cat "$OUT")" >&2; return 22 ;;
  esac
}

# Store the default password server-side (used by resetear_pass / pass_cambiada). Not readable by clients.
api POST /rest/v1/ajustes -H "Prefer: resolution=merge-duplicates" \
  -d "$(jq -n --arg v "$DEFAULT_PASS" '{clave:"pass_defecto", valor:$v}')" >/dev/null || exit 1
echo "ajustes.pass_defecto OK"

crear() { # email password nombre admin(true|false)
  local body code
  body=$(jq -n --arg e "$1" --arg p "$2" --arg n "$3" --argjson a "$4" \
    '{email:$e, password:$p, email_confirm:true, user_metadata:{nombre:$n, admin:$a}}')
  code=$(curl -sS -o "$OUT" -w '%{http_code}' "${H[@]}" -X POST "$SUPABASE_URL/auth/v1/admin/users" -d "$body") || { echo "network error creating $3" >&2; exit 1; }
  case "$code" in
    200|201) echo "created: $3" ;;
    422)     echo "skipped (already exists): $3" ;;
    *)       echo "ERROR HTTP $code creating $3: $(cat "$OUT")" >&2; exit 1 ;;
  esac
}

crear "$ADMIN_EMAIL" "$ADMIN_PASS" "$ADMIN_NAME" true

while IFS= read -r nombre || [ -n "$nombre" ]; do
  nombre="$(printf '%s' "$nombre" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$nombre" ] && continue
  # Skip players that already exist (idempotent re-runs).
  ya=$(api GET "/rest/v1/jugadores?select=id&nombre=eq.$(jq -rn --arg n "$nombre" '$n|@uri')" | jq 'length') || exit 1
  if [ "$ya" != "0" ]; then echo "skipped (already exists): $nombre"; continue; fi
  crear "$(openssl rand -hex 9)@npgingo.local" "$DEFAULT_PASS" "$nombre" false
done < "$FILE"

echo "Done. Links are shown in the app (Admin -> Enlaces)."

#!/usr/bin/env bash
# Creates the admin and the players in Supabase Auth (admin API). Run ONCE from your machine.
# Secrets come from the environment, never from the repo:
#   SUPABASE_URL        https://<ref>.supabase.co
#   SERVICE_ROLE_KEY    Project Settings -> API Keys -> service_role (secret)
#   DEFAULT_PASS        initial password for players (they must change it on first login)
#   ADMIN_EMAIL         real email of the admin
#   ADMIN_PASS          admin password (use a strong, unique one)
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
[ "${#ADMIN_PASS}" -ge 12 ] || { echo "ADMIN_PASS must have at least 12 characters" >&2; exit 1; }

H=(-H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json")

# Store the default password server-side (used by resetear_pass / pass_cambiada). Not readable by clients.
curl -fsS "${H[@]}" -H "Prefer: resolution=merge-duplicates" -X POST "$SUPABASE_URL/rest/v1/ajustes" \
  -d "$(jq -n --arg v "$DEFAULT_PASS" '{clave:"pass_defecto", valor:$v}')" >/dev/null
echo "ajustes.pass_defecto OK"

crear() { # email password nombre admin(true|false)
  local body code
  body=$(jq -n --arg e "$1" --arg p "$2" --arg n "$3" --argjson a "$4" \
    '{email:$e, password:$p, email_confirm:true, user_metadata:{nombre:$n, admin:$a}}')
  code=$(curl -sS -o /tmp/seed.out -w '%{http_code}' "${H[@]}" -X POST "$SUPABASE_URL/auth/v1/admin/users" -d "$body")
  case "$code" in
    200|201) echo "created: $3" ;;
    422)     echo "skipped (already exists): $3" ;;
    *)       echo "ERROR $code creating $3: $(cat /tmp/seed.out)" >&2; exit 1 ;;
  esac
}

crear "$ADMIN_EMAIL" "$ADMIN_PASS" "$ADMIN_NAME" true

while IFS= read -r nombre || [ -n "$nombre" ]; do
  nombre="$(printf '%s' "$nombre" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$nombre" ] && continue
  # Skip players that already exist (idempotent re-runs).
  ya=$(curl -fsS "${H[@]}" -G "$SUPABASE_URL/rest/v1/jugadores" --data-urlencode "nombre=eq.$nombre" --data-urlencode "select=id" | jq 'length')
  if [ "$ya" != "0" ]; then echo "skipped (already exists): $nombre"; continue; fi
  crear "$(openssl rand -hex 9)@npgingo.local" "$DEFAULT_PASS" "$nombre" false
done < "$FILE"

rm -f /tmp/seed.out
echo "Done. Links are shown in the app (Admin -> Enlaces)."

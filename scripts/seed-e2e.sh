#!/usr/bin/env bash
#
# Nucleus — seed the demo fixture used by the Playwright suite AND
# shared with Juan for hands-on review.
#
# Idempotent: running twice yields the same end state (same row ids,
# password reset, devices reassigned, latest telemetry replaced).
#
# Usage:
#   scripts/seed-e2e.sh                  # against the default base URL
#   E2E_BASE_URL=http://127.0.0.1:3000 scripts/seed-e2e.sh
#
# Exit codes:
#   0 — seed complete
#   1 — required env var missing or HTTP call failed
#
# Dependencies:
#   curl, jq (jq used only for friendly error messages; not strictly required)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

E2E_BASE_URL="${E2E_BASE_URL:-https://app.sensu.com.mx}"
SECRET="${E2E_HOOKS_SECRET:-}"
EMAIL="${NUCLEUS_DEMO_EMAIL:-}"
PASSWORD="${NUCLEUS_DEMO_PASSWORD:-}"
FULL_NAME="${NUCLEUS_DEMO_FULL_NAME:-Demo Sensu}"
DEVICE_A="${NUCLEUS_DEMO_DEVICE_PRIMARY:-EV-DEMO-0001}"
DEVICE_B="${NUCLEUS_DEMO_DEVICE_SECONDARY:-EV-DEMO-0002}"
# Real EV-12 pendant Juan activated on LocTube (2026-05-05). Linked to
# the demo account so the acceptance review sees the live device on the
# same dashboard as the seeded ones, and pressing SOS on the physical
# pendant lands the alert here in real time.
DEVICE_EV12="${NUCLEUS_DEMO_DEVICE_EV12:-861615072578829}"
ADMIN_EMAIL="${NUCLEUS_ADMIN_EMAIL:-admin@sensu.com.mx}"
ADMIN_PASSWORD="${NUCLEUS_ADMIN_PASSWORD:-}"
ADMIN_FULL_NAME="${NUCLEUS_ADMIN_FULL_NAME:-Admin Sensu}"

red()    { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; }
yellow() { printf '\033[33m· %s\033[0m\n' "$*"; }
green()  { printf '\033[32m✓ %s\033[0m\n' "$*"; }

require() {
  if [[ -z "${!1:-}" ]]; then
    red "missing required env: $1 (check $ENV_FILE)"
    exit 1
  fi
}
require SECRET
require EMAIL
require PASSWORD

hook_post() {
  local path="$1"
  local body="$2"
  local resp
  local code
  resp=$(curl -sS -o /tmp/nucleus-seed-resp.json -w '%{http_code}' \
    -X POST "${E2E_BASE_URL}${path}" \
    -H 'Content-Type: application/json' \
    -H "x-e2e-hook-secret: ${SECRET}" \
    --data "${body}" || echo 000)
  code="$resp"
  if [[ "$code" != "200" ]]; then
    red "POST $path → HTTP $code"
    cat /tmp/nucleus-seed-resp.json >&2 || true
    exit 1
  fi
}

hook_delete() {
  local path="$1"
  local code
  code=$(curl -sS -o /tmp/nucleus-seed-resp.json -w '%{http_code}' \
    -X DELETE "${E2E_BASE_URL}${path}" \
    -H "x-e2e-hook-secret: ${SECRET}" || echo 000)
  if [[ "$code" != "200" ]]; then
    red "DELETE $path → HTTP $code"
    cat /tmp/nucleus-seed-resp.json >&2 || true
    exit 1
  fi
}

yellow "seeding demo user :: $EMAIL"
hook_post /api/dev/seed-user "$(printf '{"email":"%s","password":"%s","fullName":"%s"}' \
  "$EMAIL" "$PASSWORD" "$FULL_NAME")"

yellow "wiping prior events on demo devices (deterministic re-seed)"
# Each new seed run computes timestamps from `now - Nmin`, so re-seeds
# without a wipe would stack duplicates — the ±1s idempotency window
# inside seed-alert can't help when the wall clock advances. Clear
# everything on the demo devices BEFORE seed-device replants the
# heartbeat telemetry, otherwise we'd wipe out the very telemetry the
# device cards read.
hook_delete "/api/dev/events?deviceId=${DEVICE_A}"
hook_delete "/api/dev/events?deviceId=${DEVICE_B}"
# DO NOT wipe events on the EV-12 — that pendant is real hardware
# streaming live events from LocTube. Clearing its history would erase
# real production data. Seed-device below is idempotent on (userEmail,
# deviceId), so re-linking just refreshes the label/battery/last-seen
# metadata without touching the EviewEvent rows.

yellow "assigning primary device :: $DEVICE_A (Mexico City fix)"
hook_post /api/dev/seed-device "$(printf '{"userEmail":"%s","deviceId":"%s","label":"Botón principal","isPrimary":true,"batteryLevel":86,"lastSeenMinutesAgo":3,"lat":19.4326,"lng":-99.1332}' \
  "$EMAIL" "$DEVICE_A")"

yellow "assigning secondary device :: $DEVICE_B (Polanco fix)"
hook_post /api/dev/seed-device "$(printf '{"userEmail":"%s","deviceId":"%s","label":"Botón de respaldo","isPrimary":false,"batteryLevel":42,"lastSeenMinutesAgo":17,"lat":19.4338,"lng":-99.1959}' \
  "$EMAIL" "$DEVICE_B")"

yellow "linking real EV-12 pendant :: $DEVICE_EV12 (LocTube live)"
hook_post /api/dev/seed-device "$(printf '{"userEmail":"%s","deviceId":"%s","label":"EV-12 (Juan, prueba)","isPrimary":false,"batteryLevel":88,"lastSeenMinutesAgo":5}' \
  "$EMAIL" "$DEVICE_EV12")"

yellow "wiping prior geofences on demo devices (deterministic re-seed)"
# Geofences are wiped here so the seed below plants exactly the
# Casa+Hospital pair we want; the /geofences CRUD spec uses a separate
# `e2e+geocrud@` fixture so demo's seeded zones survive a full E2E run.
hook_delete "/api/dev/geofences?deviceId=${DEVICE_A}"
hook_delete "/api/dev/geofences?deviceId=${DEVICE_B}"

yellow "seeding alert history :: 3 events on $DEVICE_A"
# Three alert types, all recent enough to survive accumulated test
# traffic on this device. The dashboard + login specs assert every
# seeded type appears in the first page of the feed; older minutesAgo
# values (24h / 30min) got buried over time when E2E tests fired many
# new SOS rows on the same device via /api/dev/seed-alert
# forceDuplicate. Keeping all three within the last 5 minutes ensures
# the assertions never lose to fixture drift.
hook_post /api/dev/seed-alert "$(printf '{"deviceId":"%s","eventType":"sos","minutesAgo":2,"buttonType":"SOS Button","batteryLevel":85,"lat":19.4326,"lng":-99.1332}' \
  "$DEVICE_A")"
hook_post /api/dev/seed-alert "$(printf '{"deviceId":"%s","eventType":"fall_detection","minutesAgo":3,"batteryLevel":83,"lat":19.4326,"lng":-99.1332}' \
  "$DEVICE_A")"
hook_post /api/dev/seed-alert "$(printf '{"deviceId":"%s","eventType":"battery_low","minutesAgo":4,"batteryLevel":15}' \
  "$DEVICE_A")"

# 2026-05-26 pricing pivot (Juan). Net centavos stored; display adds
# 16% IVA on top so the breakdown reads "$550 + 16% IVA = $638" the way
# Juan wrote it in WhatsApp 2026-05-27. The numbers on his Pricing
# Strategy sheet are the GROSS amounts; we reverse-derive net by
# dividing by 1.16. Final values after Juan's 2026-05-27 12:50 PM team
# huddle:
#   Initial Fee gross $2,461.52 → net $2,122 = $2,000 device + $122 act.
#   Monthly  gross $638    → net $550
#   Semestral gross $3,446 → net $2,970.69 ("Ahorra 7%")
#   Annual   gross $6,738 → net $5,808.62 ("Ahorra 12%")
# Total tier deferred pending Juan's 2026-06-01 decision on Aura vs
# Cruz Roja Mexicana — if Red Cross wins, Total likely collapses into
# Esencial.
yellow "seeding plan cadence pricing :: Esencial"
hook_post /api/dev/upsert-plan-pricing '{"planType":"ANGELA_ESENCIAL","initialFeeCents":212200,"priceMonthlyCents":55000,"priceSemestralCents":297069,"priceAnnualCents":580862}'

if [[ -n "$ADMIN_PASSWORD" ]]; then
  yellow "seeding admin user :: $ADMIN_EMAIL"
  hook_post /api/dev/seed-user "$(printf '{"email":"%s","password":"%s","fullName":"%s","role":"ADMIN"}' \
    "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_FULL_NAME")"

  yellow "seeding 4 deterministic Esencial registrations (cadence mix)"
  # Total tier retired 2026-06-02 (Cruz Roja partnership). All four demo
  # registrations are Esencial now; cadence varies (MONTHLY / SEMESTRAL
  # / ANNUAL / MONTHLY) so the /admin/registrations cadence column and
  # the dashboard subscription card still have a spread of values to
  # render against. Use the @sensu.com.mx domain (NOT @nucleus-test.local)
  # so these demo rows stay VISIBLE in /admin/registrations after the
  # admin-list filter kicks out E2E-only emails — demo accounts that
  # populate the human-facing admin should look like real customers.
  # Index 1 = MONTHLY, index 2 = ANNUAL so the dashboard-subscription
  # spec's pre-collapse expectation against demo+esencial-2 keeps holding.
  # Indices 3 + 4 cover the remaining two cadences for filter-mix coverage.
  esencial_cadences=(MONTHLY ANNUAL SEMESTRAL MONTHLY)
  for i in 1 2 3 4; do
    cadence="${esencial_cadences[$((i-1))]}"
    hook_post /api/dev/seed-registration "$(printf '{"email":"demo+esencial-%d@sensu.com.mx","password":"Sensu-Reg-2026!","fullName":"Esencial Family %d","phone":"+52 55 0000 010%d","planType":"ANGELA_ESENCIAL","status":"ACTIVE","cadence":"%s"}' \
      "$i" "$i" "$i" "$cadence")"
  done
fi

yellow "populating demo's profile (medical fields for hands-on review)"
# Demo's User row already has fullName + phone from /api/dev/seed-user;
# this layers in the medical questionnaire so /profile and /dashboard
# look like a real family for client demos.
hook_post /api/dev/seed-profile "$(printf '{"userEmail":"%s","phone":"+52 55 1234 5678","heightCm":168,"weightKg":72,"bloodType":"O+","medicalConditions":"Hipertensión controlada con losartán. Alergia a la penicilina."}' \
  "$EMAIL")"

yellow "seeding 2 geofences for demo (Casa, Hospital cercano — populated /geofences for review)"
# Two zones around the seeded device's CDMX fix so /geofences renders
# populated for client review. The /geofences CRUD page-spec uses a
# DEDICATED `e2e+geocrud@` fixture (seeded below) instead of demo, so
# these survive a full E2E run.
hook_post /api/dev/seed-geofence "$(printf '{"userEmail":"%s","deviceId":"%s","name":"Casa","centerLat":19.4326,"centerLng":-99.1332,"radiusMeters":250,"direction":"BOTH"}' \
  "$EMAIL" "$DEVICE_A")"
hook_post /api/dev/seed-geofence "$(printf '{"userEmail":"%s","deviceId":"%s","name":"Hospital cercano","centerLat":19.4290,"centerLng":-99.1390,"radiusMeters":150,"direction":"ENTER"}' \
  "$EMAIL" "$DEVICE_A")"

yellow "seeding 'no-devices' family (empty-state fixture)"
# A Family Account with NO UserDevice rows — covers the dashboard +
# geofences empty-state tests for the future page-spec rewrite.
hook_post /api/dev/seed-user '{"email":"e2e+nodevices@nucleus-test.local","password":"Sensu-Empty-2026!","fullName":"No Devices Family"}'

yellow "seeding 'geocrud' family (dedicated fixture for /geofences CRUD spec)"
# This is the user the /geofences page-spec drives — two devices so the
# 4-zone-per-device limit test can fill 8 slots, kept SEPARATE from
# demo so that demo's seeded geofences survive a full E2E run.
hook_post /api/dev/seed-user '{"email":"e2e+geocrud@nucleus-test.local","password":"Sensu-Geocrud-2026!","fullName":"Geocrud CRUD Family"}'
hook_delete "/api/dev/events?deviceId=EV-GEOCRUD-0001"
hook_delete "/api/dev/events?deviceId=EV-GEOCRUD-0002"
hook_delete "/api/dev/geofences?deviceId=EV-GEOCRUD-0001"
hook_delete "/api/dev/geofences?deviceId=EV-GEOCRUD-0002"
hook_post /api/dev/seed-device '{"userEmail":"e2e+geocrud@nucleus-test.local","deviceId":"EV-GEOCRUD-0001","label":"Geocrud A","isPrimary":true,"batteryLevel":80,"lastSeenMinutesAgo":10,"lat":19.4326,"lng":-99.1332}'
hook_post /api/dev/seed-device '{"userEmail":"e2e+geocrud@nucleus-test.local","deviceId":"EV-GEOCRUD-0002","label":"Geocrud B","isPrimary":false,"batteryLevel":50,"lastSeenMinutesAgo":15,"lat":19.4338,"lng":-99.1959}'

yellow "seeding 'no-GPS' family (devices but no fix — DASH-4 map-empty case)"
# A Family Account with TWO devices, neither with a GPS fix — covers the
# dashboard's `device-map-empty` state. Cards still render; map shows
# the "sin contacto" copy.
hook_post /api/dev/seed-user '{"email":"e2e+nogps@nucleus-test.local","password":"Sensu-NoGps-2026!","fullName":"No GPS Family"}'
hook_delete "/api/dev/events?deviceId=EV-NOGPS-0001"
hook_delete "/api/dev/events?deviceId=EV-NOGPS-0002"
hook_post /api/dev/seed-device '{"userEmail":"e2e+nogps@nucleus-test.local","deviceId":"EV-NOGPS-0001","label":"Sin fix #1","isPrimary":true,"batteryLevel":71,"lastSeenMinutesAgo":120,"lat":null,"lng":null}'
hook_post /api/dev/seed-device '{"userEmail":"e2e+nogps@nucleus-test.local","deviceId":"EV-NOGPS-0002","label":"Sin fix #2","isPrimary":false,"batteryLevel":35,"lastSeenMinutesAgo":240,"lat":null,"lng":null}'

yellow "seeding admin's own device (proves /dashboard server-side userId filter)"
# Admin gets ONE device the demo family doesn't own. The /dashboard
# Admin lens asserts admin sees this single device, not the demo
# family's two — proves `fetchUserDevices(userId)` filters by session,
# not globally.
if [[ -n "$ADMIN_PASSWORD" ]]; then
  hook_delete "/api/dev/events?deviceId=EV-ADMIN-0001"
  hook_delete "/api/dev/geofences?deviceId=EV-ADMIN-0001"
  hook_post /api/dev/seed-device "$(printf '{"userEmail":"%s","deviceId":"EV-ADMIN-0001","label":"Botón admin","isPrimary":true,"batteryLevel":92,"lastSeenMinutesAgo":2,"lat":19.4250,"lng":-99.1700}' \
    "$ADMIN_EMAIL")"

  yellow "populating admin's profile (medical fields for hands-on review)"
  hook_post /api/dev/seed-profile "$(printf '{"userEmail":"%s","phone":"+52 55 9999 0000","heightCm":175,"weightKg":78,"bloodType":"A+","medicalConditions":"Sin condiciones relevantes."}' \
    "$ADMIN_EMAIL")"

  yellow "seeding 1 geofence for admin (Oficina — populated /geofences for review)"
  hook_post /api/dev/seed-geofence "$(printf '{"userEmail":"%s","deviceId":"EV-ADMIN-0001","name":"Oficina","centerLat":19.4250,"centerLng":-99.1700,"radiusMeters":200,"direction":"BOTH"}' \
    "$ADMIN_EMAIL")"
fi

# NOTE: we do NOT seed geofences for the demo user here, because Step 10
# spec asserts "demo user starts with zero geofences" as part of its
# CRUD flow. The /geofences page-spec (when written) plants its own
# fixtures inside beforeAll and cleans up in afterAll.

yellow "seeding parity observations (TS + PYTHON pair for /admin/parity)"
# Both halves of one matched pair so the dashboard renders populated
# stats. The TS row is what the worker would have written; the PYTHON
# row is what the legacy subscriber would have written. Same event,
# different sources — divergent=false because the fields agree.
# Seed at "now" rather than 5 minutes ago so the PYTHON row stays inside
# the recent-20 view shown on /admin/parity. The production worker is now
# writing live TS parity rows for every EV-12 / EV-DEMO event coming in
# from LocTube — at the current rate (~7 TS rows/minute) a 5-minute-old
# seed row gets buried before the parity spec runs.
parity_ts=$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')
hook_post /api/dev/parity-mirror "$(printf '{"source":"TS","eviewDeviceId":"%s","eventType":"sos","timestampIso":"%s","statusCode":4096,"batteryLevel":86,"lat":19.4326,"lng":-99.1332}' \
  "$DEVICE_A" "$parity_ts")"
hook_post /api/dev/parity-mirror "$(printf '{"source":"PYTHON","eviewDeviceId":"%s","eventType":"sos","timestampIso":"%s","statusCode":4096,"batteryLevel":86,"lat":19.4326,"lng":-99.1332}' \
  "$DEVICE_A" "$parity_ts")"

yellow "seeding 7 canonical support articles (manuals, videos, guides)"
hook_post /api/dev/seed-support-article '{"slug":"como-poner-el-sensu","title":"Cómo colocar la Angela en tu familiar","body":"La Angela se usa como un colgante alrededor del cuello o sujeto a una pretina.\n\nVerifica que el botón rojo central quede al alcance del pulgar y que el dispositivo cuelgue justo bajo el esternón. La distancia ideal es de 2 a 3 cm sobre la piel.","iconKey":"shield","priority":10,"imageUrl":"https://res.cloudinary.com/dcfjvxt5h/image/upload/v1765229421/vectux-academy/raw/l1.webp"}'
hook_post /api/dev/seed-support-article '{"slug":"como-cargar-tu-sensu","title":"Cómo cargar tu Angela","body":"Conecta el cable magnético al puerto trasero de la Angela y enchúfalo a cualquier USB de 5V.\n\nUna carga completa dura entre 4 y 7 días según el uso. El LED parpadea rojo cuando queda menos del 20% de batería.","iconKey":"battery-charging","priority":20,"imageUrl":"https://res.cloudinary.com/dcfjvxt5h/image/upload/v1766305681/109eedd0-00db-4746-915d-8cc530e328e0.png"}'
hook_post /api/dev/seed-support-article '{"slug":"significado-de-los-leds","title":"¿Qué significa cada LED?","body":"Verde fijo: dispositivo activo y conectado.\n\nVerde parpadeante lento: buscando señal GPS.\n\nRojo parpadeante: batería baja (menos de 20%).\n\nAmarillo: actualizando ubicación.\n\nApagado: dispositivo en reposo o sin batería.","iconKey":"bell-ring","priority":30,"imageUrl":"https://res.cloudinary.com/dcfjvxt5h/image/upload/v1765229368/vectux-academy/raw/diploma-9.webp"}'
hook_post /api/dev/seed-support-article '{"slug":"como-funciona-el-boton-sos","title":"Cómo funciona el botón SOS","body":"Mantén presionado el botón central durante 3 segundos. El dispositivo vibrará una vez para confirmar la alarma.\n\nEl call center recibe la alerta de forma inmediata, llama al familiar y coordina la emergencia. La ubicación GPS se comparte en tiempo real con el centro de monitoreo.","iconKey":"life-buoy","priority":40,"imageUrl":"https://res.cloudinary.com/dcfjvxt5h/image/upload/v1765228969/vectux-academy/raw/diploma-8.jpg"}'
hook_post /api/dev/seed-support-article '{"slug":"como-leer-el-mapa","title":"Cómo leer el mapa en vivo","body":"El círculo verde indica la última ubicación reportada por el dispositivo. El número en la esquina muestra hace cuántos minutos se actualizó.\n\nSi el círculo se ve amarillo o rojo, el dispositivo está reportando alertas activas. Toca el círculo para ver detalles.","iconKey":"map-pin","priority":50,"imageUrl":"https://res.cloudinary.com/dcfjvxt5h/image/upload/v1765225253/vectux-academy/raw/aibusiness-2048x1080.webp"}'
hook_post /api/dev/seed-support-article '{"slug":"como-configurar-una-geocerca","title":"Cómo configurar una geocerca","body":"Una geocerca define una zona segura — por ejemplo, la casa, el parque o el hospital. Si tu familiar entra o sale de esa zona, recibes una notificación.\n\nVe a Geocercas, presiona Nueva geocerca y dibuja el círculo sobre el mapa. Ajusta el radio según el tamaño del lugar.","iconKey":"map-pin","priority":60,"videoUrl":"https://res.cloudinary.com/dnezzlq3p/video/upload/v1778781139/WhatsApp_Video_2026-05-14_at_10.39.18_AM_kgrktm.mp4"}'
hook_post /api/dev/seed-support-article '{"slug":"como-contactar-al-call-center","title":"Cómo contactar al call center","body":"El call center de Sensu está activo 24/7. Si necesitas ayuda inmediata para tu familiar, llama al 800 057 0180 desde cualquier teléfono.\n\nTambién puedes presionar el botón SOS en el dispositivo, y el call center llamará al instante.","iconKey":"phone","priority":70,"videoUrl":"https://res.cloudinary.com/dnezzlq3p/video/upload/v1778767075/WhatsApp_Video_2026-05-14_at_7.44.29_AM_qybwxl.mp4"}'

yellow "wiping stale Playwright-leftover Company rows (preserves real clients)"
hook_post /api/dev/wipe-test-companies '{"preserve":["Medtronic"]}'

green "demo fixture seeded :: ${EMAIL} / [password in .env]"

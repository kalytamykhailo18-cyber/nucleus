# @nucleus/worker

TypeScript MQTT subscriber for the Eview cloud (`mq.loctube.com:11883`).
Replaces the Python subscriber inside `sensu-api`, with byte-for-byte
event compatibility for the EV-04 family. Runs in parallel with the
Python version during the Step-14 parity window before Python is retired.

## What it does

1. Connect to LocTube MQTT with our credentials (`EVIEW_MQTT_*` env vars).
2. Subscribe to `/device/${productId}/+/message/#` and `/device/+/+/message/#`
   (a product-agnostic catch-all so EV-12 and future models flow through).
3. For each message: classify it via `src/alarm.ts` (SOS, fall_detection,
   battery_low, geofence_enter / geofence_exit, button_press, heartbeat).
4. Persist alerts to `EviewEvent` via `src/save-event.ts` (60s dedup
   window keyed on `(deviceId, eventType, statusCode)`, advisory lock to
   serialize concurrent writes for the same key).
5. Fan out web-push notifications via `src/push.ts` for SOS / fall /
   battery / geofence (best-effort, never breaks the save).
6. Record a `WorkerParityCheck` row per save tagged `source='TS'` so the
   Step-14 comparator can diff against the Python observations.

## Local development

```bash
pnpm --filter @nucleus/worker build         # compile to dist/
pnpm --filter @nucleus/worker start         # run against env from nucleus/.env
```

The Step-6 spec spawns this same binary against a host-side mosquitto
container — proves the integration round-trips end to end.

## Operational notes

- The worker is started by `docker-compose.yml` as `nucleus-worker`.
  Healthcheck is a bare `pgrep node` — if Node dies, compose restarts it.
- Dead-letter behaviour: malformed JSON → `failed: 1` counter incremented
  in the next `health` log line; the offending payload is logged at
  `level: 'error'` with a 200-char preview. We do NOT requeue — the
  broker has its own retry semantics.
- EV-12 schema (product `MX037`) currently passes through with raw
  topic-name `eventType` because the bitmap doc from Eview hasn't landed.
  See `overview/project_sensu_test_devices.md` for the open ask.

## Logs

JSON-per-line, friendly to `docker logs | jq`:

```bash
sudo docker logs --since 10m nucleus-worker | jq -C
```

Key log shapes:

```
{ "msg": "event saved", "deviceId": "...", "eventType": "sos", "eventId": "..." }
{ "msg": "event deduped", "deviceId": "...", "eventType": "sos" }
{ "msg": "event save failed", "deviceId": "...", "error": "..." }
{ "msg": "push dispatched", "eventId": "...", "attempts": 2 }
{ "msg": "health", "uptimeSec": 1800, "received": 38, "saved": 15, "deduped": 21, "failed": 0 }
```

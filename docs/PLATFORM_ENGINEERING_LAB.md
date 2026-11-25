# VeloPulse Platform Engineering Lab

This document accompanies the `feat/platform-lab` branch and collects practical Platform Engineering experiments built around VeloPulse.

---

## 1. Start the Full Local Stack (Web + Go Telemetry + OpenTelemetry + Jaeger)

```bash
make platform
```

Running services:
- **Vite Webapp**: `http://localhost:5173`
- **Go Telemetry Service**:
  - HTTP `/healthz`: `http://localhost:8081/healthz`
  - Prometheus `/metrics`: `http://localhost:8081/metrics`
  - Traced event ingestion: `POST http://localhost:8081/v1/events`
  - gRPC Health + Reflection: `localhost:50051`
- **Jaeger UI (OpenTelemetry Traces)**: `http://localhost:16686`

### Quick Smoke Test (Trace + Metrics + Structured JSON Logs)
```bash
curl -s -X POST http://localhost:8081/v1/events \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"demo","provider":"intervals","event_type":"sync","duration_ms":340,"success":true}'
```
Then open `http://localhost:16686` and select the `velopulse-telemetry` service.

---

## 2. PostgreSQL in Production (`EXPLAIN ANALYZE` & Zero-Downtime Migrations)

### Query Plan Inspection on Supabase
In the Supabase SQL Editor, verify that `idx_activities_user_date` is used:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, start_date_local, training_load
FROM public.activities
WHERE user_id = auth.uid()
ORDER BY start_date_local DESC
LIMIT 200;
```
What to look for:
- **Index Scan** on `idx_activities_user_date` instead of a `Seq Scan` (critical as tables grow to millions of rows).
- **Buffers**: `shared hit` vs `read` (cache hit ratio).

### Zero-Downtime Migration Pattern (Expand & Contract)
In production, never rename or drop a column in place while older app instances are still running:
1. **Expand**: add the new nullable column (`ALTER TABLE activities ADD COLUMN ...`), backfill in batches, and dual-write if needed.
2. **Switch**: deploy application code that reads/writes the new column.
3. **Contract**: only once no older instance reads the legacy column, drop the old column/trigger.

---

## 3. Key Concepts (Temporal, Kubernetes Networking & RBAC)

- **Temporal (Durable Execution)**: orchestrates long-running or failure-prone workflows (e.g. multi-step syncs, exponential-backoff retries, LLM pipelines). Each step (*Activity*) is persisted in an event history: if a worker crashes mid-flight, another worker resumes from the exact last completed step without losing state.
- **Kubernetes Networking & RBAC**:
  - **NetworkPolicy**: cluster-internal firewall enforcing *default-deny* and allowing only explicit pod-to-pod traffic (e.g. `api -> postgres:5432`, never `frontend -> postgres`).
  - **RBAC (`Role` / `ClusterRole` + `RoleBinding`)**: enforces *least privilege* for pod `ServiceAccount`s (e.g. preventing a service from reading `Secret` objects in other namespaces).

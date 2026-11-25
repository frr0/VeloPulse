# VeloPulse Platform Engineering Lab

Questo documento accompagna il branch `feat/platform-lab` e raccoglie gli esperimenti pratici di Platform Engineering costruiti attorno a VeloPulse.

---

## 1. Avviare lo stack locale completo (Web + Go Telemetry + OpenTelemetry + Jaeger)

```bash
make platform
```

Servizi attivi:
- **Webapp Vite**: `http://localhost:5173`
- **Go Telemetry Service**:
  - HTTP `/healthz`: `http://localhost:8081/healthz`
  - Prometheus `/metrics`: `http://localhost:8081/metrics`
  - Ingestione eventi tracciati: `POST http://localhost:8081/v1/events`
  - gRPC Health + Reflection: `localhost:50051`
- **Jaeger UI (OpenTelemetry Traces)**: `http://localhost:16686`

### Esempio di test rapido (Trace + Metriche + Log JSON)
```bash
curl -s -X POST http://localhost:8081/v1/events \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"demo","provider":"intervals","event_type":"sync","duration_ms":340,"success":true}'
```
Poi apri `http://localhost:16686` e cerca il servizio `velopulse-telemetry`.

---

## 2. PostgreSQL in Produzione (`EXPLAIN ANALYZE` & Zero-Downtime Migrations)

### Analisi delle query reali su Supabase
Nel SQL Editor di Supabase puoi verificare l'uso dell'indice `idx_activities_user_date`:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, start_date_local, training_load
FROM public.activities
WHERE user_id = auth.uid()
ORDER BY start_date_local DESC
LIMIT 200;
```
Cosa osservare:
- **Index Scan** su `idx_activities_user_date` invece di `Seq Scan` (fondamentale quando la tabella cresce a milioni di righe).
- **Buffers**: `shared hit` vs `read` (cache hit ratio).

### Pattern Zero-Downtime Migration (Expand & Contract)
In produzione non si rinomina o elimina mai una colonna di colpo mentre la vecchia versione dell'app è ancora attiva:
1. **Expand**: aggiungi la nuova colonna nullable (`ALTER TABLE activities ADD COLUMN ...`) + backfill a batch + trigger/doppio write.
2. **Switch**: deploya il codice che legge/scrive la nuova colonna.
3. **Contract**: solo quando nessuna istanza vecchia legge più la vecchia colonna, rimuovi la vecchia colonna/trigger.

---

## 3. Concetti Chiave (Temporal, Kubernetes Networking & RBAC)

- **Temporal (Durable Execution)**: orchestra workflow lunghi o critici (es. sync multi-step, retry con backoff esponenziale, chiamate LLM). Ogni step (*Activity*) è persistito in una history di eventi: se il worker crasha, un altro worker riprende esattamente dallo step interrotto senza perdere stato.
- **Kubernetes Networking & RBAC**:
  - **NetworkPolicy**: firewall interno al cluster che applica *default-deny* e permette traffico solo tra pod autorizzati (es. `api -> postgres:5432`, mai `frontend -> postgres`).
  - **RBAC (`Role` / `ClusterRole` + `RoleBinding`)**: principio del *least privilege* per i `ServiceAccount` dei pod (es. un servizio non deve avere accesso ai `Secret` di altri namespace).

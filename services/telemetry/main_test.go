package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
)

func TestHealthAndEventIngestion(t *testing.T) {
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	reg := prometheus.NewRegistry()
	m := newMetrics(reg)
	mux := newHTTPMux(logger, m, reg)

	// 1. Health check
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /healthz, got %d", rec.Code)
	}

	// 2. Event ingestion
	payload, _ := json.Marshal(TelemetryEvent{
		UserID:     "user-1",
		Provider:   "intervals",
		EventType:  "sync",
		DurationMs: 420,
		Success:    true,
	})
	evReq := httptest.NewRequest(http.MethodPost, "/v1/events", bytes.NewReader(payload))
	evRec := httptest.NewRecorder()
	mux.ServeHTTP(evRec, evReq)
	if evRec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 from POST /v1/events, got %d", evRec.Code)
	}

	// 3. Prometheus metrics check
	mReq := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	mRec := httptest.NewRecorder()
	mux.ServeHTTP(mRec, mReq)
	if mRec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /metrics, got %d", mRec.Code)
	}
	if !strings.Contains(mRec.Body.String(), `velopulse_telemetry_events_total{event_type="sync",provider="intervals",status="ok"} 1`) {
		t.Fatalf("expected Prometheus counter to increment, got:\n%s", mRec.Body.String())
	}
}

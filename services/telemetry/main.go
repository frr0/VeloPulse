package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

type TelemetryEvent struct {
	UserID     string `json:"user_id"`
	Provider   string `json:"provider"`
	EventType  string `json:"event_type"`
	DurationMs int64  `json:"duration_ms"`
	Success    bool   `json:"success"`
}

type metrics struct {
	eventsTotal     *prometheus.CounterVec
	requestDuration *prometheus.HistogramVec
}

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		eventsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "velopulse_telemetry_events_total",
				Help: "Total telemetry events ingested by provider and status.",
			},
			[]string{"provider", "event_type", "status"},
		),
		requestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "velopulse_http_request_duration_seconds",
				Help:    "HTTP request latency in seconds.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"path", "method"},
		),
	}
	reg.MustRegister(m.eventsTotal, m.requestDuration)
	return m
}

func initTracer(ctx context.Context, logger *slog.Logger) func(context.Context) error {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		logger.Info("OTEL_EXPORTER_OTLP_ENDPOINT not set, using local noop tracer")
		return func(context.Context) error { return nil }
	}

	exporter, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpointURL(endpoint))
	if err != nil {
		logger.Warn("failed to initialize OTLP exporter, falling back to noop", "error", err)
		return func(context.Context) error { return nil }
	}

	res, _ := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName("velopulse-telemetry"),
			semconv.ServiceVersion("1.0.0"),
		),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	logger.Info("OpenTelemetry tracer initialized", "otlp_endpoint", endpoint)
	return tp.Shutdown
}

func newHTTPMux(logger *slog.Logger, m *metrics, reg *prometheus.Registry) *http.ServeMux {
	tracer := otel.Tracer("velopulse-telemetry")
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","service":"velopulse-telemetry"}`))
	})

	mux.Handle("GET /metrics", promhttp.HandlerFor(reg, promhttp.HandlerOpts{}))

	mux.HandleFunc("POST /v1/events", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ctx, span := tracer.Start(r.Context(), "ingest_telemetry_event", trace.WithSpanKind(trace.SpanKindServer))
		defer span.End()

		var ev TelemetryEvent
		if err := json.NewDecoder(r.Body).Decode(&ev); err != nil {
			http.Error(w, `{"error":"invalid JSON payload"}`, http.StatusBadRequest)
			return
		}
		if ev.Provider == "" {
			ev.Provider = "unknown"
		}
		if ev.EventType == "" {
			ev.EventType = "sync"
		}

		status := "error"
		if ev.Success {
			status = "ok"
		}

		span.SetAttributes(
			attribute.String("velopulse.provider", ev.Provider),
			attribute.String("velopulse.event_type", ev.EventType),
			attribute.Int64("velopulse.duration_ms", ev.DurationMs),
			attribute.Bool("velopulse.success", ev.Success),
		)

		m.eventsTotal.WithLabelValues(ev.Provider, ev.EventType, status).Inc()
		m.requestDuration.WithLabelValues("/v1/events", "POST").Observe(time.Since(start).Seconds())

		sc := span.SpanContext()
		logger.InfoContext(ctx, "telemetry event recorded",
			"trace_id", sc.TraceID().String(),
			"span_id", sc.SpanID().String(),
			"provider", ev.Provider,
			"event_type", ev.EventType,
			"duration_ms", ev.DurationMs,
			"success", ev.Success,
		)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"accepted": true,
			"trace_id": sc.TraceID().String(),
		})
	})

	return mux
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	shutdownTracer := initTracer(ctx, logger)
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = shutdownTracer(shutdownCtx)
	}()

	reg := prometheus.NewRegistry()
	m := newMetrics(reg)

	httpAddr := envOr("HTTP_ADDR", ":8081")
	grpcAddr := envOr("GRPC_ADDR", ":50051")

	// Start gRPC server with OpenTelemetry instrumentation + Health + Reflection
	grpcLis, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		logger.Error("failed to listen gRPC", "addr", grpcAddr, "error", err)
		os.Exit(1)
	}
	grpcServer := grpc.NewServer(grpc.StatsHandler(otelgrpc.NewServerHandler()))
	healthSrv := health.NewServer()
	healthSrv.SetServingStatus("velopulse.telemetry.v1.TelemetryService", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthSrv)
	reflection.Register(grpcServer)

	go func() {
		logger.Info("gRPC server listening", "addr", grpcAddr)
		if serveErr := grpcServer.Serve(grpcLis); serveErr != nil {
			logger.Error("gRPC server exited", "error", serveErr)
		}
	}()

	httpServer := &http.Server{
		Addr:              httpAddr,
		Handler:           newHTTPMux(logger, m, reg),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("HTTP server listening", "addr", httpAddr)
		if serveErr := httpServer.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			logger.Error("HTTP server exited", "error", serveErr)
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down telemetry service")
	grpcServer.GracefulStop()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(shutdownCtx)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

.PHONY: up build down logs prod

# Start local dev environment (Vite HMR on http://localhost:5173)
up:
	docker compose up

# Rebuild image and start local dev environment
build:
	docker compose up --build

# Build and run production bundle locally (http://localhost:8080)
prod:
	docker compose --profile prod up --build

# Stop and remove containers
down:
	docker compose --profile prod down

# Follow dev container logs
logs:
	docker compose logs -f app

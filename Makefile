.PHONY: \
	up down restart logs \
	frontend-rebuild frontend-restart frontend-clean frontend-logs \
	backend-rebuild  backend-restart  backend-clean  backend-logs \
	rebuild clean

COMPOSE = docker compose

# ─────────────────────────────────────────────────────────────
#  Whole-stack helpers
# ─────────────────────────────────────────────────────────────

## Start all services (detached)
up:
	$(COMPOSE) up -d

## Stop all services
down:
	$(COMPOSE) down

## Restart all services
restart:
	$(COMPOSE) restart

## Follow logs for all services
logs:
	$(COMPOSE) logs -f

## Remove old images, rebuild frontend + backend images, then restart them (db/redis untouched)
rebuild:
	$(COMPOSE) stop app backend
	$(COMPOSE) rm -f app backend
	docker rmi -f $$(docker images -q --filter "label=com.docker.compose.service=app")     2>/dev/null || true
	docker rmi -f $$(docker images -q --filter "label=com.docker.compose.service=backend") 2>/dev/null || true
	$(COMPOSE) build app backend
	$(COMPOSE) up -d app backend

## Remove frontend + backend containers and their images
clean:
	$(COMPOSE) stop app backend
	$(COMPOSE) rm -f app backend
	docker rmi -f $$(docker images -q --filter "label=com.docker.compose.service=app")     2>/dev/null || true
	docker rmi -f $$(docker images -q --filter "label=com.docker.compose.service=backend") 2>/dev/null || true

# ─────────────────────────────────────────────────────────────
#  Frontend  (service: app)
# ─────────────────────────────────────────────────────────────

## Stop, remove, rebuild image, and restart the frontend container
frontend-rebuild:
	$(COMPOSE) stop app
	$(COMPOSE) rm -f app
	$(COMPOSE) build app
	$(COMPOSE) up -d app

## Restart the frontend container (no image rebuild)
frontend-restart:
	$(COMPOSE) restart app

## Stop and remove the frontend container and its image
frontend-clean:
	$(COMPOSE) stop app
	$(COMPOSE) rm -f app
	docker rmi -f $$(docker images -q --filter "label=com.docker.compose.service=app") 2>/dev/null || true

## Follow frontend logs
frontend-logs:
	$(COMPOSE) logs -f app

# ─────────────────────────────────────────────────────────────
#  Backend  (service: backend)
# ─────────────────────────────────────────────────────────────

## Stop, remove, rebuild image, and restart the backend container
backend-rebuild:
	$(COMPOSE) stop backend
	$(COMPOSE) rm -f backend
	$(COMPOSE) build backend
	$(COMPOSE) up -d backend

## Restart the backend container (no image rebuild)
backend-restart:
	$(COMPOSE) restart backend

## Stop and remove the backend container and its image
backend-clean:
	$(COMPOSE) stop backend
	$(COMPOSE) rm -f backend
	docker rmi -f $$(docker images -q --filter "label=com.docker.compose.service=backend") 2>/dev/null || true

## Follow backend logs
backend-logs:
	$(COMPOSE) logs -f backend

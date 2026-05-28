BACKEND_DIR := backend
FRONTEND_DIR := frontend

.PHONY: dev test lint

dev:
	@echo "Frontend dev server: http://localhost:$${FRONTEND_PORT:-5151} (after compose up)"
	docker compose up

test:
	# B0.1 intentionally skips coverage when no tests exist yet; B0.3 restores the
	# coverage gate once the first backend test is committed.
	@if find backend/app/tests -type f \( -name 'test_*.py' -o -name '*_test.py' \) | grep -q .; then \
		cd $(BACKEND_DIR) && .venv/bin/python -m pytest app/tests --cov=app --cov-fail-under=80; \
	else \
		cd $(BACKEND_DIR) && .venv/bin/python -m pytest app/tests; \
	fi
	cd $(FRONTEND_DIR) && npm run test -- --coverage

lint:
	cd $(BACKEND_DIR) && .venv/bin/python -m ruff check app
	cd $(BACKEND_DIR) && .venv/bin/python -m mypy app --strict
	cd $(BACKEND_DIR) && .venv/bin/radon cc app -n C
	cd $(FRONTEND_DIR) && npx tsc --noEmit --project tsconfig.json
	cd $(FRONTEND_DIR) && npm run lint

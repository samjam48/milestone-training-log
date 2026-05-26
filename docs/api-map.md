# API map

This document describes the **HTTP API implemented by the FastAPI application** in this repository (`backend/app/`). It is grounded in routers, `main.py`, settings, Pydantic schemas, and service modules—**not** in external product docs unless they match code.

**Base URL path:** All routers below are mounted under `settings.api_v1_prefix`, default **`/api/v1`** (`backend/app/core/config.py`, `backend/app/main.py`).
The setting is loaded from env var **`MOMENTUM_API_V1_PREFIX`** (because `Settings` uses `env_prefix="MOMENTUM_"`).

**Interactive OpenAPI:** FastAPI’s default **`/docs`** and **`/redoc`** are available unless disabled elsewhere (not customized in `main.py`).

### API prefix contract

- Backend route prefix: `MOMENTUM_API_V1_PREFIX` defaults to `/api/v1`.
- Frontend API modules currently hardcode `'/api/v1/...'` request paths (for example `frontend/src/api/projects.ts`, `tasks.ts`, `ventures.ts`) and prepend only the host/base origin from `VITE_API_BASE_URL` in `frontend/src/api/client.ts`.
- Contract: if `MOMENTUM_API_V1_PREFIX` changes, frontend path constants must be updated in lockstep (or centralized first) to keep requests aligned. Changing `VITE_API_BASE_URL` alone does not change the `/api/v1` path segment.

---

## Architecture overview

| Topic | Detail |
|--------|--------|
| **Framework** | FastAPI (`backend/app/main.py` → `create_app()`). |
| **Routers** | `backend/app/routers/*.py`; each file defines an `APIRouter` with a path prefix; `create_app()` calls `include_router(..., prefix=settings.api_v1_prefix, ...)`. |
| **Business logic** | `backend/app/services/*.py` — routers delegate here; services use SQLModel `Session` for persistence. |
| **Request/response models** | `backend/app/schemas/*.py` (Pydantic / SQLModel schema classes). |
| **Database session** | `Depends(get_session)` → `SessionDep` (`backend/app/db/database.py`). |
| **Authentication / authorization** | **None implemented** in `main.py` or routers reviewed: no API keys, JWT, or session middleware. All endpoints are **unauthenticated** unless added elsewhere outside the reviewed files. |
| **CORS** | `CORSMiddleware` with origins from `MOMENTUM_CORS_ORIGINS` (comma-separated), default localhost dev ports (`backend/app/main.py`). |

---

## Global behaviours

### Success and error status codes

| Code | When |
|------|------|
| **200** | Successful GET, PATCH, DELETE that returns a body (some DELETEs return 204 instead). |
| **201** | Successful POST creating a resource. |
| **204** | Successful DELETE (or PATCH) with **no response body** (`Response` with no content). |
| **405** | Method exists but is intentionally not implemented for that resource action (for example project/venture DELETE archive aliases removed). |
| **400** | Well-formed request violates a non-state rule (for example, empty PATCH body where at least one field is required). |
| **404** | `HTTPException` from services when a primary entity is missing (wording varies per `detail` string). |
| **409** | Conflict rules (e.g. archived entity cannot be modified). |
| **422** | Validation-layer failures (Pydantic body/query/path validation). FastAPI’s default validation error JSON shape applies. Service-level `422` also remains in a few explicit domain-validation paths: project board reorder payload composition (`order`), `category_label_id: null` on venture PATCH, and slug-content validation in `_slugify()` for activity types and venture category labels (e.g. punctuation-only names → `"name must contain letters or numbers"`). |

There are **no custom global exception handlers** in `main.py`; expect standard FastAPI / Starlette behaviour for unhandled exceptions (typically **500**).

### Side effects

| Kind | Present? |
|------|-----------|
| Email, webhooks, queues, analytics | **No** references in the reviewed routers/services. |
| File uploads | **No** multipart upload routes in reviewed code. |
| Background jobs | **No** `BackgroundTasks` in reviewed routers. |
| Cache invalidation | **No** cache layer in reviewed code. |

---

## Endpoint summary table

Full paths assume default prefix **`/api/v1`**.

| Method | Path | Summary |
|--------|------|---------|
| GET | `/health` | Liveness / version payload. |
| GET | `/projects` | List projects (filters). |
| POST | `/projects` | Create project. |
| GET | `/projects/{project_id}` | Get project by id. |
| PATCH | `/projects/{project_id}` | Update project. |
| POST | `/projects/{project_id}/archive` | Archive project (optional body). |
| DELETE | `/projects/{project_id}` | Not implemented; use POST archive route. |
| PATCH | `/projects/{project_id}/unarchive` | Unarchive project. |
| PATCH | `/projects/{project_id}/board-status` | Update board column / order / batch reorder. |
| GET | `/tasks` | List tasks (filters). |
| POST | `/tasks` | Create task. |
| GET | `/tasks/{task_id}` | Get task. |
| PATCH | `/tasks/{task_id}` | Update task. |
| DELETE | `/tasks/{task_id}` | Hard-delete task and archive child time logs. |
| PATCH | `/tasks/{task_id}/status` | Update task status (Kanban). |
| GET | `/tasks/{task_id}/time-logs` | List time logs for task. |
| POST | `/tasks/{task_id}/time-logs` | Create manual time log. |
| PATCH | `/tasks/{task_id}/time-logs/{time_log_id}` | Update time log. |
| DELETE | `/tasks/{task_id}/time-logs/{time_log_id}` | Delete time log. |
| GET | `/activity-types` | List activity types. |
| POST | `/activity-types` | Create activity type. |
| PATCH | `/activity-types/{activity_type_id}` | Update activity type. |
| DELETE | `/activity-types/{activity_type_id}` | Delete activity type (hard, if unused). |
| PATCH | `/activity-types/{activity_type_id}/archive` | Archive activity type and detach from time logs. |
| GET | `/venture-category-labels` | List labels + usage counts. |
| POST | `/venture-category-labels` | Create label. |
| PATCH | `/venture-category-labels/{label_id}` | Update label. |
| DELETE | `/venture-category-labels/{label_id}` | Delete label (if unused). |
| GET | `/ventures` | List ventures. |
| POST | `/ventures` | Create venture. |
| GET | `/ventures/{venture_id}` | Get venture (embeds category label summary). |
| PATCH | `/ventures/{venture_id}` | Update venture. |
| POST | `/ventures/{venture_id}/archive` | Archive venture (+ cascade archive active projects). |
| DELETE | `/ventures/{venture_id}` | Not implemented; use POST archive route. |
| PATCH | `/ventures/{venture_id}/unarchive` | Unarchive venture (+ restore venture-archived projects). |

**Total:** **35** route operations in the summary table.

---

## Domain: Health

### `GET /api/v1/health`

| | |
|--|--|
| **Purpose** | Simple health check; returns static `status` and app version from settings. |
| **Source** | `backend/app/routers/health.py` |
| **Auth** | None. |
| **Parameters** | None. |
| **Response** | `200` — JSON object `{"status": "ok", "version": "<app_version>"}`. |
| **DB** | None. |
| **Services** | None (reads `get_settings()` only). |

**Example**

```http
GET /api/v1/health HTTP/1.1
```

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

## Domain: Projects

Router: `backend/app/routers/projects.py` — prefix `/projects`  
Service: `backend/app/services/projects.py`  
Schemas: `backend/app/schemas/project.py`

### `GET /api/v1/projects`

| | |
|--|--|
| **Purpose** | List projects for a status tab / filters. |
| **Query params** | `status` (alias for `status_filter`): optional `active` \| `archived`. **Default if omitted:** service treats as **`active`**. `venture_id`: optional string. `board_status`: optional `idea` \| `active` \| `paused` \| `shipped`. `project_type`: optional `project` \| `asset` \| `gig` \| `contract`. `finished`: optional boolean. `limit`: optional int (1..500) enables cursor pagination. `cursor`: optional string; valid only when `limit` is provided. |
| **Response** | `200` — without `limit`: JSON array of `ProjectRead`. With `limit`: `{ "items": ProjectRead[], "next_cursor": string \| null }`. |
| **Ordering** | Service: board status rank (idea → active → paused → shipped), then `kanban_order` nulls last, then `created_at`, then `id`. Paginated responses preserve this same ordering. |
| **DB** | `projects` |
| **Errors** | Standard validation if query types invalid → **422**. Invalid cursor token → **400**. |

**Example:** `GET /api/v1/projects?venture_id=<uuid>&board_status=active`

---

### `POST /api/v1/projects`

| | |
|--|--|
| **Purpose** | Create a project under an **active** venture. |
| **Body** | `ProjectCreate`: required `venture_id`, `name`; optional `description`, `colour` (`#RRGGBB`), `icon`, `project_type` (default `project`), `board_status` (default `active`), `kanban_order`, `finished` (default `false`). |
| **Validation** | Name non-blank after strip; colour regex; literals as per schema. |
| **Response** | `201` — `ProjectRead`. |
| **DB** | `projects`, reads `ventures` |
| **Errors** | **404** venture not found; **409** venture archived (`"Archived ventures cannot own active projects."`). |

---

### `GET /api/v1/projects/{project_id}`

| | |
|--|--|
| **Purpose** | Fetch single project (any `status` in DB). |
| **Response** | `200` — `ProjectRead`. |
| **Errors** | **404** `"Project not found."` |

---

### `PATCH /api/v1/projects/{project_id}`

| | |
|--|--|
| **Purpose** | Partial update; **blocked** when project already archived. |
| **Body** | `ProjectUpdate` — all fields optional, but **`venture_id` must not be JSON `null`** (validator raises). |
| **Response** | `200` — `ProjectRead`. |
| **Errors** | **404** project; **409** `"Archived projects are read-only."`; **404**/ **409** same venture rules as create when changing `venture_id`. |

---

### `POST /api/v1/projects/{project_id}/archive`

| | |
|--|--|
| **Purpose** | **Archive** project (soft), not hard delete. |
| **Body** | Optional `ProjectArchive`: `finished` boolean or omit. If `finished` omitted, service sets `finished` to `true` when `board_status == "shipped"`, else `false`. |
| **Response** | `204` empty. |
| **Errors** | **404** if project id missing. |

---

### `DELETE /api/v1/projects/{project_id}`

| | |
|--|--|
| **Purpose** | Not implemented for archive semantics. |
| **Response** | **405** with guidance to use `POST /api/v1/projects/{project_id}/archive`. |

---

### `PATCH /api/v1/projects/{project_id}/unarchive`

| | |
|--|--|
| **Purpose** | Set project `status` to `active` if archived, when parent venture is active. |
| **Response** | `200` — `ProjectRead`. |
| **Errors** | **404** project; **409** `"Cannot unarchive project under archived venture."` |

---

### `PATCH /api/v1/projects/{project_id}/board-status`

| | |
|--|--|
| **Purpose** | Move project on Kanban board; optional batch reorder within same venture and target column. |
| **Body** | `ProjectBoardStatusUpdate`: required `board_status`; optional `kanban_order`, `finished`, `order` (list of `{ project_id, kanban_order }`). |
| **Rules** | If `order` present: non-empty, unique ids, all projects must exist, not archived, same `venture_id` as target project, same `board_status` as payload. If `board_status` is `shipped` and `finished` omitted, `finished` defaults to `true`. |
| **Response** | `200` — `ProjectRead` (primary project after refresh). |
| **Errors** | **404**; **409** archived project or venture archived; **422** various `order` validation messages (see `project_services.update_project_board_status`). |

---

## Domain: Tasks & time logs

Router: `backend/app/routers/tasks.py` — prefix `/tasks`  
Service: `backend/app/services/tasks.py`  
Schemas: `backend/app/schemas/task.py`

### `GET /api/v1/tasks`

| | |
|--|--|
| **Purpose** | List tasks. |
| **Query** | `project_id` optional. `status` optional (`backlog` \| `in_progress` \| `review` \| `done` \| `archived`). **If `status` omitted**, service excludes `archived` by default. `priority` optional (`low` \| `medium` \| `high` \| `urgent`). `limit`: optional int (1..500) enables cursor pagination. `cursor`: optional string; valid only when `limit` is provided. |
| **Response** | `200` — without `limit`: `TaskRead[]`. With `limit`: `{ "items": TaskRead[], "next_cursor": string \| null }`. |
| **DB** | `tasks` |
| **Ordering** | `created_at` ascending. |
| **Errors** | Invalid cursor token → **400**. `cursor` without `limit` or invalid `limit` bounds → **422**. |

---

### `POST /api/v1/tasks`

| | |
|--|--|
| **Purpose** | Create task on a project. |
| **Body** | `TaskCreate`: required `project_id`, `title`; optional `description`, `status` (Kanban literals only), `priority`, `estimated_hours` (≥ 0), `target_date`, `kanban_order`. |
| **Response** | `201` — `TaskRead`. |
| **Errors** | **404** project missing; **409** project archived. |

---

### `GET /api/v1/tasks/{task_id}`

| | |
|--|--|
| **Purpose** | Get one task. |
| **Errors** | **404** `"Task not found."` |

---

### `PATCH /api/v1/tasks/{task_id}`

| | |
|--|--|
| **Purpose** | Partial update; recomputes `completed_date` from status when applicable. |
| **Body** | `TaskUpdate` — optional fields include `project_id`, `status` (full set including `archived`), etc. |
| **Errors** | **404** task; **404**/ **409** if target project archived when applying change. |

---

### `DELETE /api/v1/tasks/{task_id}`

| | |
|--|--|
| **Purpose** | **Hard delete** task and archive child time logs (`status='archived'`, `task_id=NULL`, `project_id` preserved). |
| **Response** | `204` empty. |
| **Errors** | **404** task. |

---

### `PATCH /api/v1/tasks/{task_id}/status`

| | |
|--|--|
| **Purpose** | Kanban status update with optional `kanban_order`. |
| **Body** | `TaskStatusUpdate`: `status` (`backlog` \| `in_progress` \| `review` \| `done`), optional `kanban_order`. |
| **Response** | `200` — `TaskRead`. |
| **Errors** | **404** task; **409** when moving **`archived` → Kanban** if parent project **`archived`**, parent venture **`archived`**, or venture missing while `venture_id` is set. |

---

### `GET /api/v1/tasks/{task_id}/time-logs`

| | |
|--|--|
| **Purpose** | List time logs for task, newest `logged_date` / `created_at` first; returns only rows with `status='active'` still attached to this task (`task_id` match). Archived/detached rows are excluded. |
| **Pagination** | Deferred by design in this phase: `limit`/`cursor` are ignored on this endpoint; response shape remains `TimeLogRead[]`. |
| **Response** | `200` — `TimeLogRead[]` with `activity_type_name` / `activity_type_display_name` populated when linked. |
| **Errors** | **404** if task id invalid. |

---

### `POST /api/v1/tasks/{task_id}/time-logs`

| | |
|--|--|
| **Purpose** | Append manual time log (`source` stored as `manual`). |
| **Body** | `TimeLogCreate`: required `hours` (> 0), `logged_date`; optional `activity_type_id` (must be **active** type), `notes`, `title`, `location`. |
| **Response** | `201` — `TimeLogRead`. |
| **Side effects** | Recomputes `tasks.actual_hours`. |
| **Errors** | **404** task; **409** invalid/archived activity type id. |

---

### `PATCH /api/v1/tasks/{task_id}/time-logs/{time_log_id}`

| | |
|--|--|
| **Purpose** | Partial update of log belonging to task. |
| **Body** | `TimeLogUpdate` — at least one field required (service **400** if empty). |
| **Response** | `200` — `TimeLogRead`. |
| **Side effects** | Recomputes `tasks.actual_hours` if `hours` changes. |
| **Errors** | **404** wrong task or missing log; **400** empty body; **409** invalid/archived activity type id. |

---

### `DELETE /api/v1/tasks/{task_id}/time-logs/{time_log_id}`

| | |
|--|--|
| **Purpose** | Delete one log. |
| **Response** | `204` empty. |
| **Side effects** | Recomputes `tasks.actual_hours`. |

---

## Domain: Activity types

Router: `backend/app/routers/activity_types.py` — `/activity-types`  
Service: `backend/app/services/activity_types.py`  
Schemas: `backend/app/schemas/activity_type.py`

### `GET /api/v1/activity-types`

| | |
|--|--|
| **Query** | `status`: optional `active` \| `archived`. **Default:** `active`. `limit`: optional int (1..500) enables cursor pagination. `cursor`: optional string; valid only when `limit` is provided. |
| **Response** | `200` — without `limit`: `ActivityTypeRead[]` ordered by `sort_order` nulls last, then `created_at`. With `limit`: `{ "items": ActivityTypeRead[], "next_cursor": string \| null }`, using the same ordering sequence. |
| **DB** | `activity_types` |

---

### `POST /api/v1/activity-types`

| | |
|--|--|
| **Body** | `ActivityTypeCreate`: `name` (non-blank, max 25 chars). Slug derived server-side; slug `uncategorised` forbidden. |
| **Response** | `201` — `ActivityTypeRead`. |
| **Errors** | **409** duplicate name/slug or reserved slug (`uncategorised`). Shape validation cases remain **422**. |

---

### `PATCH /api/v1/activity-types/{activity_type_id}`

| | |
|--|--|
| **Body** | `ActivityTypeUpdate` (name only with same validation rules). |
| **Response** | `200` — `ActivityTypeRead`. |
| **Errors** | **404** `"Activity type not found."` |

---

### `DELETE /api/v1/activity-types/{activity_type_id}`

| | |
|--|--|
| **Purpose** | Hard delete if **no** time logs reference it. |
| **Response** | `204` empty. |
| **Errors** | **404**; **409** `"Activity type is used by time logs."` |

---

### `PATCH /api/v1/activity-types/{activity_type_id}/archive`

| | |
|--|--|
| **Purpose** | Set type to `archived`; sets `time_logs.activity_type_id` to `NULL` for linked rows. |
| **Response** | `204` empty. |
| **Errors** | **404** if id missing. |

---

## Domain: Venture category labels

Router: `backend/app/routers/venture_category_labels.py` — `/venture-category-labels`  
Service: `backend/app/services/venture_category_labels.py`  
Schemas: `backend/app/schemas/venture_category_label.py`

### `GET /api/v1/venture-category-labels`

| | |
|--|--|
| **Purpose** | List all labels with `usage_count` (number of ventures referencing each). |
| **Query** | `limit`: optional int (1..500) enables cursor pagination. `cursor`: optional string; valid only when `limit` is provided. |
| **Response** | `200` — without `limit`: `VentureCategoryLabelRead[]` (seeded slugs sort first per service). With `limit`: `{ "items": VentureCategoryLabelRead[], "next_cursor": string \| null }`, preserving the same seeded-rank/name/id ordering. |
| **DB** | `venture_category_labels`, aggregate on `ventures` |

---

### `POST /api/v1/venture-category-labels`

| | |
|--|--|
| **Body** | `VentureCategoryLabelCreate`: `name` (non-blank). Slug derived; duplicate slug → **409** `"name already exists"`. |
| **Response** | `201` — `VentureCategoryLabelRead` with `usage_count: 0`. |

---

### `PATCH /api/v1/venture-category-labels/{label_id}`

| | |
|--|--|
| **Body** | `VentureCategoryLabelUpdate`: `name`. |
| **Errors** | **404** `"Venture category label not found."` |

---

### `DELETE /api/v1/venture-category-labels/{label_id}`

| | |
|--|--|
| **Purpose** | Hard delete when `usage_count == 0`. |
| **Response** | `204` empty. |
| **Errors** | **404**; **409** `"Label is in use by one or more ventures."` |

---

## Domain: Ventures

Router: `backend/app/routers/ventures.py` — `/ventures`  
Service: `backend/app/services/ventures.py`  
Schemas: `backend/app/schemas/venture.py`

### `GET /api/v1/ventures`

| | |
|--|--|
| **Query** | `status`: optional `active` \| `archived` — **default `active`**. `category_label_id` optional filter. `limit`: optional int (1..500) enables cursor pagination. `cursor`: optional string; valid only when `limit` is provided. |
| **Response** | `200` — without `limit`: `VentureRead[]` each including nested `category_label` summary. With `limit`: `{ "items": VentureRead[], "next_cursor": string \| null }`. |
| **DB** | `ventures`, `venture_category_labels` |

---

### `POST /api/v1/ventures`

| | |
|--|--|
| **Body** | `VentureCreate`: `name`; optional `description`, `colour` (must be from approved palette in schema), `category_label_id` (defaults to label with slug **`hustle`** if omitted), `icon`. |
| **Response** | `201` — `VentureRead`. |
| **Errors** | **404** label not found; **404** `"Default venture category label not found."` if hustle label missing. |

---

### `GET /api/v1/ventures/{venture_id}`

| | |
|--|--|
| **Errors** | **404** `"Venture not found."` or label not found. |

---

### `PATCH /api/v1/ventures/{venture_id}`

| | |
|--|--|
| **Purpose** | Update; **blocked** when venture already archived. |
| **Body** | `VentureUpdate` — optional fields; **`category_label_id` must not be JSON `null`** (service **422**). |
| **Errors** | **409** `"Archived ventures are read-only."` |

---

### `POST /api/v1/ventures/{venture_id}/archive`

| | |
|--|--|
| **Purpose** | Archive venture; cascades to active projects (sets them archived, `archived_by_venture=true`). **Idempotent:** if already archived, returns **204** without error. |
| **Response** | `204` empty. |

---

### `DELETE /api/v1/ventures/{venture_id}`

| | |
|--|--|
| **Purpose** | Not implemented for archive semantics. |
| **Response** | **405** with guidance to use `POST /api/v1/ventures/{venture_id}/archive`. |

---

### `PATCH /api/v1/ventures/{venture_id}/unarchive`

| | |
|--|--|
| **Purpose** | Set venture `active`; restores projects where `archived_by_venture` is true. |
| **Response** | `200` — `VentureRead`. |

---

## Response shapes (reference)

Exact field sets match Pydantic models in `backend/app/schemas/`. Notable computed/read-only fields:

- **`TimeLogRead`:** `activity_type_display_name` defaults to `"uncategorised"` when no name (`tasks._to_time_log_read`).
- **`VentureCategoryLabelRead`:** `usage_count` computed in service, not a DB column.
- **`VentureRead`:** includes nested `category_label: { id, name, slug }`.

---

## Suspicious / duplicate / undocumented notes

| Topic | Observation |
|--------|----------------|
| **“Delete” vs archive** | Archive is explicit via `POST /projects/{id}/archive` and `POST /ventures/{id}/archive`. `DELETE /tasks/{id}` hard-deletes the task while archiving detached child time logs. |
| **Task status routes** | Both `PATCH /tasks/{id}` and `PATCH /tasks/{id}/status` can change status with different request bodies; not duplicate but overlapping surface. |
| **Activity type DELETE vs PATCH archive** | Two ways to retire types; delete is hard and blocked when referenced. |
| **OpenAPI vs this doc** | This file can drift from `/docs`; prefer routers/schemas as source of truth when they disagree. |

---

## Files to read when modifying the API

| Concern | Path |
|---------|------|
| Route list | `backend/app/main.py`, `backend/app/routers/*.py` |
| Validation & response shapes | `backend/app/schemas/*.py` |
| Status codes & rules | `backend/app/services/*.py` |
| DB session | `backend/app/db/database.py` |
| URL prefix & CORS | `backend/app/core/config.py`, `backend/app/main.py` |

# Raw and cleaned data pages

## Overview

The web app shows only the finished run-level table. This adds two pages for the earlier stages: the three datasets as the exercise API sends them, and the same datasets after notebook 02's cleaning. A left sidebar moves between pages.

The sidebar lists Raw data, Cleaned data, and Run results, each at its own address (`/raw`, `/cleaned`, `/`), and sits above the content on a phone. `/` is still the run results table, so http://localhost:8080 opens where it does today. Raw data loads production runs, counter readings, and downtime events on open. Cleaned data waits for a click on "Clean data". Both pages write values as JSON, like the notebooks, so `"1180"` versus `1180`, `null`, and stray spaces stay visible.

The backend gets `/api/raw/<dataset>` and `/api/cleaned/<dataset>` for each dataset, six endpoints in all. Both pull live from `https://exercise.convanalytics.com/api/` on every request, which matched `analysis/data/raw/` when this plan was written. Cleaning ports notebook 02 and nothing more: UTC times, tidied product codes, target rates in cases per hour, `payload` split into count and unit, numeric-text counts as integers. Duplicate and bad readings stay, downtime reasons stay as sent, and matching and metrics stay in notebooks 03–04. `/api/runs` does not change.

The endpoints and the sidebar are built at the same time, and the two pages after both.

Risks: the new pages need internet, and when the exercise API is down each table shows the error. The port duplicates notebook 02, so a change to one must be made in the other. Data the cleaning can't handle, such as an unknown rate unit or a timestamp without a time zone, returns an error, never a guessed value.

When it's done, all three pages work through the sidebar in `docker compose up`, and refreshing any of them stays on that page.

## Shared

`api` and `data-pages` share one contract. The datasets are `production_runs`, `counter_readings`, and `downtime_events`, the exercise API's own names, shown in that order. `GET /api/raw/<dataset>` and `GET /api/cleaned/<dataset>` answer 200 with a JSON array of record objects. Keys keep the order the source sends them in, and cleaned records use the key order notebook 02 produces, for example `run_id, equipment_id, start_time, end_time, product_code, target_hourly_rate, unit`. Errors use FastAPI's `{"detail": "<message>"}` body: 502 when the exercise API fails or sends data the cleaning refuses, and 404 for an unknown dataset.

`nav` and `data-pages` share the page paths `/`, `/raw`, and `/cleaned`. `RawDataPage` and `CleanedDataPage` are default exports in `frontend/src/pages/` and take no props. `nav` creates them and `data-pages` replaces their contents. Neither slice renames or moves them.

No slice adds a pip or npm dependency. Downtime reasons are shown exactly as sent, with no mapping.

## Work breakdown

| Slice | Covers | Touches | After | Size |
| --- | --- | --- | --- | --- |
| api | raw and cleaned endpoints | backend/main.py, backend/datasets.py, backend/Dockerfile, README.md | - | medium |
| nav | sidebar and page routing | frontend/src/App.tsx, frontend/src/App.css, frontend/src/index.css, frontend/src/pages/RunsPage.tsx, frontend/src/pages/RawDataPage.tsx, frontend/src/pages/CleanedDataPage.tsx | - | small |
| data-pages | raw and cleaned data pages | frontend/src/pages/RawDataPage.tsx, frontend/src/pages/CleanedDataPage.tsx, frontend/src/components/DataTable.tsx, frontend/src/components/DataTable.css, README.md | api, nav | medium |

## api

This slice adds six read-only endpoints to the FastAPI app in `backend/main.py`, two per dataset. `/api/raw/<dataset>` fetches `https://exercise.convanalytics.com/api/<dataset>` on every request and returns its records unchanged. `/api/cleaned/<dataset>` fetches the same way and applies notebook 02's steps. The fetching and cleaning go in a new `backend/datasets.py`. The cleaning is pure functions that take and return lists of records, so they can be checked against `analysis/data/raw/` without a network. Add the new file to the `COPY` in `backend/Dockerfile`.

Fetch with the standard library (`urllib.request`) and a 30-second timeout, as notebook 01 uses, so `backend/requirements.txt` stays the same. Remove the extra outer list the API wraps records in (`[[{...}, {...}]]`), as notebook 01 does. Raw records must not go through a Pydantic model or anything else that coerces types: `"1180"` stays a string and `" FLOUR-B"` keeps its leading space. Turn fetch failures (unreachable, timeout, non-2xx, invalid JSON) and refused data into an `HTTPException(502)` whose detail names the dataset, and for refused data also the record id and field.

The cleaning steps match `analysis/02_cleaning_data.ipynb`:

- Every `start_time`, `end_time`, and `recorded_at` is converted to UTC and written with `Z`. Null stays null. A timestamp without a time zone is refused.
- In production runs, `product_code` is trimmed and uppercased, and `target_rate` and `target_rate_unit` are replaced by `target_hourly_rate` (cases/minute × 60) and `unit` (`"cases"`). An unknown unit is refused.
- In counter readings, `payload` is replaced by `count` and `unit`. A count that is numeric text becomes an integer, and anything else, such as `"ERROR"`, stays as sent.
- In downtime events, only the times change.

Duplicates (C003 and C004), the `"ERROR"` reading, and count drops all stay in the output.

Add the six endpoints to the endpoint table in `README.md`, and say there that they need internet access.

- `GET /api/raw/production_runs` returns 5 records equal to `analysis/data/raw/production_runs.json` with the outer list removed, including R101's `"product_code": "flour-a "` and `"target_rate_unit": "cases/minute"`. `counter_readings` returns 24 and `downtime_events` returns 10, both equal to the snapshot, and C003's `payload.count` is the string `"1180"`.
- Cleaning the snapshot's production runs gives R100 `start_time` `"2026-08-13T13:00:00Z"`, R101 `product_code` `"FLOUR-A"` with `target_hourly_rate` 600 and `unit` `"cases"`, and R104 `end_time` null. No record has a `target_rate` or `target_rate_unit` key.
- Cleaning the snapshot's counter readings gives 24 records with no `payload` key. C003's `count` is the number 1180 and C005's is the string `"ERROR"`.
- Cleaning the snapshot's downtime events gives D003 `start_time` `"2026-08-13T14:43:30Z"` and D010 `end_time` null. D003's reason is still `"material"` and D004's is still `"MATL"`.
- `GET /api/cleaned/<dataset>` returns exactly those cleaned records for each of the three datasets.
- Given a run whose `target_rate_unit` is `"cases/day"`, or a timestamp without a time zone, the cleaning raises an error that names the record id and field, and the endpoint returns 502 with that message instead of a guessed value.
- When the exercise API can't be reached, times out, or answers with a non-2xx status, every raw and cleaned endpoint returns 502 with a detail naming the dataset. It never returns a 500, and it doesn't wait past the timeout.
- `GET /api/raw/unknown` and `GET /api/cleaned/unknown` return 404.
- `GET /api/runs` and `GET /api/runs/R101` return the same responses as before.
- `docker compose up --build` builds, and the backend container starts with the new module.

## nav

This slice adds a left sidebar that switches between three pages, and moves the existing runs table onto a page of its own. Routing uses the path: `/` for run results, `/raw` for raw data, and `/cleaned` for cleaned data. Use `history.pushState` and a `popstate` listener, with no router package. `frontend/nginx.conf` (`try_files $uri /index.html`) and the Vite dev server already serve `index.html` for these paths.

The links are real `<a href>` elements inside a labelled `<nav>`, with `aria-current="page"` on the active one. This is page navigation, not ARIA tabs. They appear in pipeline order: Raw data, Cleaned data, Run results. Move the body of `frontend/src/App.tsx` into `frontend/src/pages/RunsPage.tsx` without changing what it shows. `App.tsx` keeps the layout and the routing. Create `RawDataPage.tsx` and `CleanedDataPage.tsx` as placeholders that show only their page heading. Below roughly 720px wide, the sidebar becomes a bar above the content. Style it with the existing tokens in `frontend/src/index.css`.

- On a desktop-width window, the sidebar is on the left with the three links. The current page's link is visibly marked and has `aria-current="page"`.
- `/` shows the run results table as before, with R101 marked Lowest and the summary line below it.
- Clicking a link changes the URL and the page without a full reload, and the browser's back and forward buttons move between pages. Cmd- or Ctrl-click opens the page in a new tab.
- Refreshing on `/raw` or `/cleaned` stays on that page, both with `npm run dev` and at http://localhost:8080 under `docker compose up`.
- An unknown path such as `/nope` shows a "Page not found" message with the sidebar, not a blank page.
- At 375px wide, the links sit above the content and the page doesn't scroll sideways. The runs table scrolls inside its own frame.
- The sidebar is readable in both light and dark mode.
- `npm run build` and `npm run lint` pass in `frontend/`.

## data-pages

This slice fills in the two placeholder pages and builds the table component they share. It uses the endpoints and page paths described under Shared.

`frontend/src/components/DataTable.tsx` takes a list of records and its record count. It shows one column per key, in the order keys first appear across the records. Each value is written as JSON in a monospace font with whitespace kept, so `"1180"` versus `1180`, `null`, and the trailing space in `"flour-a "` are all visible. The nested `payload` appears as compact JSON. A record that lacks a key gets a blank cell. The table sits inside the existing `.table-wrap` from `frontend/src/App.css`, so wide tables scroll within their frame. Put any new styles in `DataTable.css`.

The raw data page fetches the three `/api/raw/<dataset>` endpoints in parallel when it opens. It shows one section per dataset, each with a heading, a one-line description, and its table. The descriptions come from notebook 01: "Production-run windows, products, equipment, and target rates", "Timestamped cumulative case-counter readings with a JSON payload", and "Timestamped equipment downtime intervals and recorded reasons". Above the tables, a short key explains the notation: quotes mean text, `null` means the API sent an empty value, and a blank cell means the record has no such field.

The cleaned data page shows a short list of the cleaning steps and a "Clean data" button, and fetches nothing until the button is clicked. A click fetches the three `/api/cleaned/<dataset>` endpoints, disables the button while they load, and shows the results in the same sections and table. Another click fetches again and replaces the results. Leaving the page discards them.

On both pages, each section shows its own loading state. A dataset that fails shows the backend's `detail`, or the HTTP status when there is none, in that section with `role="alert"`. The other sections still show their data.

Update the `frontend/` row of the folder table in `README.md` to describe the three pages.

- `/raw` shows 5 production runs, 24 counter readings, and 10 downtime events without any click. R101's product code reads `"flour-a "` with its trailing space visible, C003's count appears as `"1180"` in quotes inside its payload, and R104's end time reads `null`.
- `/cleaned` shows the steps and the button, and the browser makes no request to `/api/cleaned/` until the button is clicked.
- After the click, the button stays disabled until results arrive. The tables then show R101's product code as `"FLOUR-A"` with `target_hourly_rate` 600, C003's count as `1180` without quotes, and C005's count as `"ERROR"`.
- When a dataset request fails, its section shows the error message and the other sections still show their tables. With the backend stopped, every section shows an error. No section is left blank or stuck loading.
- At 375px wide, the tables scroll inside their frames and the page doesn't scroll sideways.
- `npm run build` and `npm run lint` pass in `frontend/`.

## After merge

- With internet access, `docker compose up --build`, then open http://localhost:8080. The sidebar reaches all three pages, `/raw` shows the live datasets, and clicking "Clean data" on `/cleaned` shows the cleaned tables.
- With the container's internet cut off, `/raw` shows a 502 error in each section, and `/` still shows the run results from the CSV.

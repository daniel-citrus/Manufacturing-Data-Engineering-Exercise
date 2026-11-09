# Manufacturing Data Engineering Exercise

Throughput analysis of packaging-line production runs, plus a small web app that shows the results.

| Folder | What's in it |
|---|---|
| [`analysis/`](analysis/) | Jupyter notebooks that pull, clean, and analyze the data. The result, assumptions, and data-quality findings are in [`analysis/README.md`](analysis/README.md). |
| [`backend/`](backend/) | FastAPI app that serves the run-level dataset (`analysis/data/processed/run_level_dataset.csv`) |
| [`frontend/`](frontend/) | Vite + React app that shows the runs in a table and marks the lowest-performing one |

## Run with Docker

```sh
docker compose up --build
```

Then open http://localhost:8080. The API is under the same address, for example http://localhost:8080/api/runs.

The backend reads the CSV from a read-only mount of `analysis/data/processed/`, so rerunning the notebooks updates the app without a rebuild.

## Run for development

Needs Python 3.11 or newer and Node 20.19 or newer.

**Backend** (from the repo root):

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload
```

It serves the API on http://localhost:8000, with interactive docs at http://localhost:8000/docs.

**Frontend** (in a second terminal):

```sh
cd frontend
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). It forwards `/api` requests to the backend on port 8000.

| Endpoint | Returns |
|---|---|
| `GET /api/runs` | Every run, with its metrics and data-quality notes |
| `GET /api/runs/{run_id}` | One run, or 404 |

Runs without an end time (R104) have `null` metrics.

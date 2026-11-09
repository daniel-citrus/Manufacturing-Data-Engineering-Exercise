# Manufacturing Data Engineering Exercise

Throughput analysis of packaging-line production runs, with a small web app that pulls the data, cleans it, and charts the results.

## Run it locally

```sh
git clone https://github.com/daniel-citrus/Manufacturing-Data-Engineering-Exercise.git
cd Manufacturing-Data-Engineering-Exercise
```

**With Docker** (any OS, needs Docker with Compose):

```sh
docker compose up --build
```

Open http://localhost:8080. If port 8080 is taken, run `PORT=9000 docker compose up --build` and open http://localhost:9000.

**Without Docker** (macOS or Linux, needs Python 3.11+ and Node 20.19+):

```sh
./dev.sh
```

Open the address it prints, usually http://127.0.0.1:5173. The first run installs everything. If port 8000 is taken, run `API_PORT=8001 ./dev.sh`.

Ctrl+C stops either one.

<details>
<summary>Windows without Docker</summary>

In one terminal, from the repo root:

```sh
py -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
cd backend
uvicorn main:app
```

In a second terminal:

```sh
cd frontend
npm install
npm run dev
```

Open the address Vite prints.

</details>

## Using the app

The app needs internet access to reach the exercise API.

1. **Raw data:** click **Pull raw data** to see the three datasets as the API sends them.
2. **Cleaned data:** click **Clean data** to see them after cleaning.
3. **Dashboard:** see which run each counter reading and downtime event belongs to, each run's metrics, the lowest-performing run, and the assumptions behind them.

Reloading the browser clears the loaded data.

## What's where

| Folder | Contents |
|---|---|
| [`analysis/`](analysis/) | Jupyter notebooks with the full analysis. Results, assumptions, and how to rerun them are in [`analysis/README.md`](analysis/README.md). |
| [`backend/`](backend/) | FastAPI app that fetches and cleans the datasets. With `./dev.sh`, its API docs are at http://127.0.0.1:8000/docs. |
| [`frontend/`](frontend/) | Vite + React app |

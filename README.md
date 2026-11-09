# Manufacturing Data Engineering Exercise

Throughput analysis of packaging-line production runs, with a small web app that pulls the data, cleans it, and charts the results.

## Run it locally

Needs Docker with Compose, on any OS.

<details>
<summary>Don't have Docker? Install it</summary>

- **macOS:** install [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/), or run `brew install --cask docker-desktop`.
- **Windows:** install [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/), or run `winget install Docker.DockerDesktop`. The installer may ask to turn on WSL 2 and restart.
- **Linux:** run `curl -fsSL https://get.docker.com | sh`, which installs Docker Engine with Compose ([other ways](https://docs.docker.com/engine/install/)). Then run `docker compose` with `sudo`, or [let your user run Docker](https://docs.docker.com/engine/install/linux-postinstall/).

`docker compose version` checks that Compose is installed. On macOS and Windows, start Docker Desktop before running `docker compose`.

</details>

```sh
git clone https://github.com/daniel-citrus/Manufacturing-Data-Engineering-Exercise.git
cd Manufacturing-Data-Engineering-Exercise
docker compose up --build
```

Open http://localhost:8080. Ctrl+C stops it.

If port 8080 is taken, run `PORT=9000 docker compose up --build` (in PowerShell, `$env:PORT=9000; docker compose up --build`) and open http://localhost:9000.

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
| [`backend/`](backend/) | FastAPI app that fetches and cleans the datasets |
| [`frontend/`](frontend/) | Vite + React app |

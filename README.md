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
2. **Cleaned data:** click **Clean data** to clean the data you pulled. It needs the raw data first.
3. **Dashboard:** see which run each counter reading and downtime event belongs to, each run's metrics, and the lowest-performing run.

Reloading the browser clears the loaded data.

## Assumptions

- Counts are a running total, so a count that drops within a run is a glitch and is ignored. That's why C010 (1760 → 25) ends R101's count at 14:40.
- A reading belongs to a run on the same machine if it falls within the run, ends included. Readings just before a run starts (C001, C014) are left out.
- A stop belongs to a run if it overlaps it. Only the overlap counts (D002), and time shared by two stops counts once (D003 and D004).
- Times are converted to UTC, trusting the offsets in the data. Rates in cases/minute are multiplied by 60.
- R104 has no end time, but C012 and C013 are good readings (inside the run, and the count goes up), so its cases are counted: 150 by 15:40. Throughput and attainment need an end time, so R104 has neither and isn't ranked, and D010 adds no downtime.

## Data-quality findings

- **All tables:** times mix `-05:00` and `Z` offsets.
- **Production runs:** product codes vary in case and spacing, target rates come in two units, and R104 has no end time.
- **Counter readings:** counts are nested in a JSON payload, some are text (`"1180"`, `"ERROR"`), C003 and C004 are duplicates, counts drop at C010 and C022, and C024 is on PKG-99, which has no runs.
- **Downtime events:** the material reason is written three ways, half the reasons are `Unknown`, D002 starts before its run, and D003 and D004 overlap.

## Unsupported conclusions

- **The lowest run:** R101 if the C010 drop is a glitch, R102 if it's a counter reset, and R103 if C001 and C014 are also used.
- **R100, R101 and R102's attainment:** counting starts late or stops early while the whole run still counts, so it's understated.
- **R104's throughput and attainment:** it has no end time, and neither does the operator stop D010 at 15:34. Ending it at the last reading (15:40) gives 83% with D010 left out and 119% with D010 counted.
- **Downtime causes:** half the reasons are `Unknown`, and the material reason isn't recorded consistently.
- **Why R103 fell short:** it logged only 3.6 minutes of downtime, so slow running and unrecorded stops can't be told apart.
- **Comparing machines or products:** each machine made different products, and there are only 5 runs.

Full detail, with the evidence and the effect of each alternative, is in [`analysis/README.md`](analysis/README.md) and notebooks 03 and 06.
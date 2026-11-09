import csv
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

RUN_LEVEL_CSV = (
    Path(__file__).resolve().parent.parent
    / "analysis"
    / "data"
    / "processed"
    / "run_level_dataset.csv"
)


class Run(BaseModel):
    run_id: str
    equipment_id: str
    product_code: str
    run_start: datetime
    run_end: datetime | None
    target_rate_cases_per_hour: float
    cases_produced: int | None
    elapsed_minutes: float | None
    downtime_minutes: float | None
    operating_minutes: float | None
    operating_throughput_cph: float | None
    target_attainment_percent: float | None
    data_quality_notes: str | None


def load_runs() -> list[Run]:
    # Read on every request so a rerun of 04_production_metrics shows up without a restart.
    with RUN_LEVEL_CSV.open(newline="") as f:
        # Empty cells (R104 has no end time or metrics) become None.
        return [Run(**{k: v or None for k, v in row.items()}) for row in csv.DictReader(f)]


app = FastAPI(title="Manufacturing Runs API")


@app.get("/api/runs")
def list_runs() -> list[Run]:
    return load_runs()


@app.get("/api/runs/{run_id}")
def get_run(run_id: str) -> Run:
    for run in load_runs():
        if run.run_id == run_id:
            return run
    raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

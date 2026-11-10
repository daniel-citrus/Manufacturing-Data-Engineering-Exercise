import csv
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from datasets import DATASETS, clean_dataset, fetch_raw

RUN_LEVEL_CSV = (
    Path(__file__).resolve().parent.parent
    / "analysis"
    / "data"
    / "processed"
    / "run_level_dataset.csv"
)
README = Path(__file__).resolve().parent.parent / "README.md"


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


def check_dataset(dataset: str) -> None:
    if dataset not in DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset} not found")


# Plain dicts, not models, so values keep the types the exercise API sent ("1180" stays text).
@app.get("/api/raw/{dataset}")
def get_raw(dataset: str) -> list[dict]:
    check_dataset(dataset)
    return fetch_raw(dataset)


@app.get("/api/cleaned/{dataset}")
def get_cleaned(dataset: str) -> list[dict]:
    check_dataset(dataset)
    return clean_dataset(dataset, fetch_raw(dataset))


# The repo's README as Markdown, for the app's README page. Read on every request, like the CSV.
@app.get("/api/readme", response_class=PlainTextResponse)
def get_readme() -> PlainTextResponse:
    if not README.is_file():
        raise HTTPException(status_code=404, detail="README.md not found")
    return PlainTextResponse(README.read_text(), media_type="text/markdown; charset=utf-8")

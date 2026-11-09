import json
import urllib.error
import urllib.request
from datetime import datetime, timezone

from fastapi import HTTPException

EXERCISE_API = "https://exercise.convanalytics.com/api/"
TIMEOUT_SECONDS = 30
DATASETS = ("production_runs", "counter_readings", "downtime_events")
CASES_PER_HOUR = {"cases/hour": 1, "cases/minute": 60}


class CleaningError(ValueError):
    """Data the cleaning refuses to guess about; names the record id and field."""


def fetch_raw(dataset: str) -> list[dict]:
    """Fetch a dataset from the exercise API, records exactly as sent."""
    try:
        with urllib.request.urlopen(EXERCISE_API + dataset, timeout=TIMEOUT_SECONDS) as response:
            data = json.load(response)
        # The API wraps the records in an extra list: [[{...}, {...}]]
        return [record for page in data for record in page]
    except (OSError, ValueError, TypeError) as error:
        # OSError covers unreachable, timeout and non-2xx (HTTPError); ValueError is invalid JSON.
        raise HTTPException(502, f"Could not load {dataset} from the exercise API: {error}")


def to_utc(timestamp: str | None, record_id: str, field: str) -> str | None:
    # Convert an ISO timestamp to UTC written with Z; null stays null.
    if timestamp is None:
        return None
    try:
        parsed = datetime.fromisoformat(timestamp)
    except (ValueError, TypeError):
        raise CleaningError(f"{record_id} {field}: invalid timestamp {timestamp!r}")
    if parsed.tzinfo is None:
        raise CleaningError(f"{record_id} {field}: timestamp has no time zone: {timestamp!r}")
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def clean_production_runs(runs: list[dict]) -> list[dict]:
    cleaned = []
    for run in runs:
        run_id = run["run_id"]
        unit = run["target_rate_unit"]
        if unit not in CASES_PER_HOUR:
            raise CleaningError(f"{run_id} target_rate_unit: unknown unit {unit!r}")
        record = {
            key: value
            for key, value in run.items()
            if key not in ("target_rate", "target_rate_unit")
        }
        record["start_time"] = to_utc(run["start_time"], run_id, "start_time")
        record["end_time"] = to_utc(run["end_time"], run_id, "end_time")
        record["product_code"] = run["product_code"].strip().upper()
        record["target_hourly_rate"] = run["target_rate"] * CASES_PER_HOUR[unit]
        record["unit"] = unit.split("/")[0]
        cleaned.append(record)
    return cleaned


def to_int(count):
    # Numeric text such as "1180" becomes 1180; anything else stays as sent.
    if isinstance(count, str) and count.strip().isdecimal():
        return int(count)
    return count


def clean_counter_readings(readings: list[dict]) -> list[dict]:
    cleaned = []
    for reading in readings:
        record = {key: value for key, value in reading.items() if key != "payload"}
        record["recorded_at"] = to_utc(reading["recorded_at"], reading["reading_id"], "recorded_at")
        record["count"] = to_int(reading["payload"]["count"])
        record["unit"] = reading["payload"]["unit"]
        cleaned.append(record)
    return cleaned


def clean_downtime_events(events: list[dict]) -> list[dict]:
    return [
        {
            **event,
            "start_time": to_utc(event["start_time"], event["event_id"], "start_time"),
            "end_time": to_utc(event["end_time"], event["event_id"], "end_time"),
        }
        for event in events
    ]


CLEANERS = {
    "production_runs": clean_production_runs,
    "counter_readings": clean_counter_readings,
    "downtime_events": clean_downtime_events,
}


def clean_dataset(dataset: str, records: list[dict]) -> list[dict]:
    try:
        return CLEANERS[dataset](records)
    except (CleaningError, KeyError, TypeError, AttributeError) as error:
        raise HTTPException(502, f"Could not clean {dataset}: {error}")

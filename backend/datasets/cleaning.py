from fastapi import HTTPException

from .assumptions import CleaningError, to_cases_per_hour, to_utc


def clean_production_runs(runs: list[dict]) -> list[dict]:
    """Times in UTC, product codes trimmed and uppercased, target rates in cases per hour."""
    cleaned = []
    for run in runs:
        run_id = run["run_id"]
        unit = run["target_rate_unit"]
        target_hourly_rate = to_cases_per_hour(run["target_rate"], unit, run_id)
        record = {
            key: value
            for key, value in run.items()
            if key not in ("target_rate", "target_rate_unit")
        }
        record["start_time"] = to_utc(run["start_time"], run_id, "start_time")
        record["end_time"] = to_utc(run["end_time"], run_id, "end_time")
        record["product_code"] = run["product_code"].strip().upper()
        record["target_hourly_rate"] = target_hourly_rate
        record["unit"] = unit.split("/")[0]
        cleaned.append(record)
    return cleaned


def to_int(count):
    """Numeric text such as "1180" becomes 1180; anything else stays as sent."""
    if isinstance(count, str) and count.strip().isdecimal():
        return int(count)
    return count


def clean_counter_readings(readings: list[dict]) -> list[dict]:
    """Times in UTC, and the payload split into a count and a unit."""
    cleaned = []
    for reading in readings:
        record = {key: value for key, value in reading.items() if key != "payload"}
        record["recorded_at"] = to_utc(reading["recorded_at"], reading["reading_id"], "recorded_at")
        record["count"] = to_int(reading["payload"]["count"])
        record["unit"] = reading["payload"]["unit"]
        cleaned.append(record)
    return cleaned


def clean_downtime_events(events: list[dict]) -> list[dict]:
    """Times in UTC; everything else as sent."""
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
    """Clean a dataset by name; data it can't clean becomes a 422 saying why."""
    try:
        return CLEANERS[dataset](records)
    except (CleaningError, KeyError, TypeError, AttributeError) as error:
        raise HTTPException(422, f"Could not clean {dataset}: {error}")

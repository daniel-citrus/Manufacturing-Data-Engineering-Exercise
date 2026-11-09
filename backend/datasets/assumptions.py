from datetime import datetime, timezone

# The cleaning that applies an assumption from analysis/03_assumptions_and_observations.
# The other assumptions (counts are a running total, and which run a reading or stop belongs to)
# apply after cleaning, when the dashboard matches records to runs in frontend/src/data/analysis.ts.

CASES_PER_HOUR = {"cases/hour": 1, "cases/minute": 60}


class CleaningError(ValueError):
    """Data the cleaning refuses to guess about; names the record id and field."""


# Assumption: all times are in UTC, and the time zone offsets in the data are assumed to be correct.
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


# Assumption: target rates in cases/minute are multiplied by 60 to get cases/hour.
def to_cases_per_hour(rate: float, unit: str, run_id: str) -> float:
    if unit not in CASES_PER_HOUR:
        raise CleaningError(f"{run_id} target_rate_unit: unknown unit {unit!r}")
    return rate * CASES_PER_HOUR[unit]

import json
import urllib.request

from fastapi import HTTPException

EXERCISE_API = "https://exercise.convanalytics.com/api/"
TIMEOUT_SECONDS = 30
USER_AGENT = "manufacturing-data-exercise/1.0"
DATASETS = ("production_runs", "counter_readings", "downtime_events")


def fetch_raw(dataset: str) -> list[dict]:
    """Fetch a dataset from the exercise API, records exactly as sent."""
    try:
        # The API returns 403 to urllib's default User-Agent, so identify this app.
        request = urllib.request.Request(EXERCISE_API + dataset, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            data = json.load(response)
        # The API wraps the records in an extra list: [[{...}, {...}]]
        return [record for page in data for record in page]
    except (OSError, ValueError, TypeError) as error:
        # OSError covers unreachable, timeout and non-2xx (HTTPError); ValueError is invalid JSON.
        raise HTTPException(502, f"Could not load {dataset} from the exercise API: {error}")

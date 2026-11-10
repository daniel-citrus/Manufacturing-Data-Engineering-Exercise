# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Reviewers evaluating this data-engineering exercise. They run the app once, locally with Docker, and check how the data was cleaned and how each metric was worked out. They use it on phones and on laptops or desktops alike, so the phone layout matters as much as the wide one.

## Product Purpose

Throughput analysis of packaging-line production runs. The app pulls three datasets from the exercise API (production runs, counter readings, downtime events), cleans them, matches readings and stops to runs, and reports each run's metrics and the lowest-performing run. Success is a reviewer who can follow any number on the dashboard back to the records and rules behind it.

## Operating Context

- Started with `docker compose up --build` and opened at http://localhost:8080. It needs internet access to reach the exercise API.
- The pages chain on one shared pull: README, then Raw data (Pull raw data), then Cleaned data (Clean data, which cleans that pull and is unavailable until it has loaded), then Dashboard, which reads what the Cleaned data page loaded. Pulling again clears the cleaned data. Reloading the browser clears the loaded data.
- The dashboard downloads the run-level result as CSV or JSON.
- The analysis also lives in the notebooks under `analysis/`, which the app's numbers match.

## Capabilities and Constraints

- Downtime reasons are shown as the source sent them; they are not mapped to standard categories.
- Before data is loaded, the dashboard shows its charts and table empty rather than a message.
- Pages carry no explanatory prose beyond short subtitles and notes; the README page holds the assumptions, data-quality findings and unsupported conclusions.
- Times are shown in UTC.

## Evidence on Hand

- The exercise API's data: 5 production runs, 24 counter readings and 10 downtime events, with the raw, cleaned and processed copies in `analysis/data/`.
- The README's assumptions, data-quality findings and unsupported conclusions, and the notebooks' evidence for each.
- No users, customers or deployments exist beyond the exercise; none should be implied.

## Product Principles

1. Every number can be traced: raw record, cleaned record, its match to a run, then the metric.
2. Show the data as it is, including its flaws; never hide or silently correct a bad record.
3. State what the data can't support instead of overclaiming.
4. Keep the screens minimal: data and charts, not narration.

## Accessibility & Inclusion

WCAG 2.2 AA, on phone and desktop, in light and dark mode.

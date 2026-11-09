# Manufacturing Data Engineering Exercise

Pulls production runs, counter readings, and downtime events from `https://exercise.convanalytics.com/api/`, cleans them, matches readings and stops to production runs, and calculates throughput for each completed run.

## Setup

Requires Python 3.11 or newer (tested with 3.13 and 3.14).

**1. Get the code and install the packages**

```sh
git clone https://github.com/daniel-citrus/Manufacturing-Data-Engineering-Exercise.git
cd Manufacturing-Data-Engineering-Exercise
python3 -m venv .venv
source .venv/bin/activate
pip install -r analysis/requirements.txt
```

On Windows, use `py -m venv .venv` and `.venv\Scripts\activate` instead of the `python3` and `source` lines.

**2. Run the notebooks**

Run these from the `analysis/` folder (`cd analysis`). Either open the notebooks in JupyterLab and use **Run → Run All Cells** in each one:

```sh
jupyter lab
```

Or rerun them all from the command line:

```sh
jupyter nbconvert --to notebook --execute --inplace --ExecutePreprocessor.kernel_name=python3 "0[2-6]*.ipynb"
```

Either way, the notebooks work offline from the API snapshot saved in `data/raw/`, give the same results, and rewrite `data/processed/run_level_dataset.csv`. To pull fresh data from the API first, run `01_pulling_data.ipynb` the same way before the others (needs internet access).

The notebooks are saved with their output, so they can also be read on GitHub without running anything.

| Notebook | What it does |
|---|---|
| `01_pulling_data` | Pulls the three endpoints and saves the raw responses to `data/raw/` |
| `02_cleaning_data` | Converts times to UTC, normalizes product codes and target rates, splits `payload`, converts counts to integers |
| `03_assumptions_and_observations` | Observations, decisions, and which readings and stops belong to each run |
| `04_production_metrics` | Metrics for each run, saved to `data/processed/run_level_dataset.csv` |
| `05_lowest_performing_run` | Ranks the completed runs and names the lowest |
| `06_unsupported_conclusions` | What the data can't support, with the evidence |

## Result

| Run | Cases | Operating minutes | Throughput (cases/hour) | Target (cases/hour) | Attainment |
|---|---|---|---|---|---|
| R100 | 420 | 54.0 | 466.7 | 600 | 77.8% |
| R101 | 250 | 50.5 | 297.0 | 600 | 49.5% |
| R102 | 280 | 55.0 | 305.5 | 420 | 72.7% |
| R103 | 290 | 56.4 | 308.4 | 420 | 73.4% |
| R104 | | | | 540 | no end time, so no metrics |

**Lowest-performing completed run: R101, at 49.5% of target.** This depends on treating the C010 drop as a glitch.

## Assumptions

- Counts are a running total, so a count that drops within a run is a glitch and is ignored.
- A reading belongs to a run on the same machine if its time falls within the run, including exactly at the start or end. A stop belongs to a run if it overlaps the run.
- Times are converted to UTC, and the time zone offsets in the data are assumed to be correct. Rates in cases/minute are multiplied by 60.

Decisions that change the result (full detail in `03`):

| Decision | Other option and its effect |
|---|---|
| C010 (1760 → 25) is a glitch, so R101 is counted only up to 14:40 | Treat it as a counter reset: R101 reaches 91.1%, and R102 becomes the lowest run |
| C001 and C014, taken 1 minute before R100 and R102 start, are left out | Use them as starting counts: R100 reaches 94% and R102 96% |
| Only D002's 4 minutes inside R101 count | Leave D002 out: R101 downtime is 5.5 minutes instead of 9.5 |
| D003 and D004's shared 1.5 minutes count once | Drop D004: those stops count 4.0 minutes instead of 5.5 |
| R104 has no end time, so it gets no metrics | Use 15:40, the last reading, as its end: 150 cases, 83% |

## Data-quality findings

- **All tables:** times mix `-05:00` and `Z` time zones.
- **Production runs:** product codes vary in case and spacing (`flour-a `, ` FLOUR-B`), target rates come in two units, and R104 has no end time.
- **Counter readings:** count and unit are nested in a JSON `payload`. Some counts are text (`"1180"`) and one is `"ERROR"` (C005). C003 and C004 are duplicates. Counts drop at C010 and C022. C024 is on `PKG-99`, which has no runs.
- **Downtime events:** the material reason is written three ways, and 5 of 10 reasons are `Unknown`. D002 starts before its run, and D003 and D004 overlap.

Each run's `data_quality_notes` in the CSV lists what affected its numbers.

## Unsupported conclusions

- **Which run performed worst:** R101 if the C010 drop is a glitch, R102 if it's a reset, and R103 if it's a reset and C001/C014 are also used.
- **R101's cases:** production after 14:40 isn't measured.
- **R100's and R102's cases:** counting starts 10 and 15 minutes late, so their attainment is understated.
- **R104:** it has no end time, and the operator stop (D010) doesn't prove the run ended.
- **What caused the downtime:** half the reasons are `Unknown`, and the material reason isn't recorded consistently.
- **Why R103 fell short:** it logged only 3.6 minutes of downtime, so slow running and unrecorded stops can't be told apart.
- **Comparing machines or products:** each machine made different products, and there are only 5 runs.

## Use of AI

I used Claude to generate the Jupyter notebooks, charts, code to clean and analyze the data, and verify that my reasoning makes logical sense.

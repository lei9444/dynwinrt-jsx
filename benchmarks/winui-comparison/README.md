# WinUI framework comparison benchmark

This benchmark compares the same 70 x 70 (4,900 TextBlock) StockGrid workload
across:

- `StressPerf.Direct`: imperative C# WinUI baseline.
- `StressPerf.ReactorOptimized`: Microsoft.UI.Reactor's optimized path.
- `DynWinRTJsx.SignalGrid`: fine-grained Signal updates over dynwinrt.

The first formal non-ETW baseline, methodology, results, limitations, and
scenario roadmap are recorded in
[`RESULTS-20260729.md`](RESULTS-20260729.md).

The dynwinrt-jsx app also contains standalone Startup and KeyedList scenarios:

```powershell
cd .\benchmarks\winui-comparison\dynwinrt-jsx

node main.js --scenario startup --out .winapp\results\startup.json

node main.js --scenario keyed-list `
  --percent 50 `
  --duration 10 `
  --out .winapp\results\keyed-list.json
```

Their Direct/Reactor interleaved runner legs are the next suite expansion.

The suite now also provides:

```powershell
# Keyed structural churn (JSX vs Reactor KeyedList)
.\run-comparison.ps1 -Scenario KeyedList

# Blank startup (Direct WinUI vs JSX vs Reactor)
.\run-startup.ps1

# Virtualized scrolling, optionally with live insert/remove edits
.\run-virtual-list.ps1 -Count 5000 -WithEdits

# ControlModel M1/M2/M3/M7/M8/M9/M10
.\run-micro.ps1 -Iterations 100 -Reps 5
```

Startup, KeyedList, VirtualList, and the comparable ControlModel micro subset
have all completed one-repetition smoke comparisons. Baseline-quality results
still require the documented warmups/repetitions and, for visual frame claims,
elevated ETW Present tracing.

The Direct and Reactor applications come from the sibling
`microsoft-ui-reactor/tests/stress_perf` suite. The dynwinrt-jsx application
ports its `StockDataSource` dimensions, 33 ms update interval, mutation
percentages, and seeded `System.Random` compatibility algorithm.

## Quick run

```powershell
.\benchmarks\winui-comparison\run-comparison.ps1 `
  -ReactorRoot ..\microsoft-ui-reactor `
  -Percents 0,50,100 `
  -Duration 10 `
  -Warmup 1 `
  -Reps 3
```

Reactor currently pins the .NET 10 SDK in its `global.json`. If it is installed
outside `PATH`, pass `-DotnetPath C:\path\to\dotnet.exe`.

Use `-Reps 12 -Warmup 2` for baseline-quality results. Use `-SkipBuild` after
all three variants are prepared. `-ForceGenerate` regenerates the dynwinrt
bindings.

Run elevated with `-IncludeEtw` to launch Reactor's `PresentTracer` for each
process and add attributed Present/s, frame interval, and global VSync values.

## Output

Each run writes:

- `raw.jsonl`: one complete record per process run.
- `summary.json`: medians and paired Direct-relative 95% CI bands.
- per-run stdout, stderr, metrics, and optional PresentTracer CSV files.

The common headline metrics are:

- completed updates/renders per second;
- update plus framework commit/reconcile milliseconds;
- externally sampled peak process RSS and CPU time;
- optional ETW Present/s and p50/p95 present interval.

Runtime-specific allocation metrics remain separate. Reactor reports managed
allocation and GC counts; dynwinrt-jsx reports V8 heap and heap delta. Do not
compare those byte values directly.

The headline `rendersPerSec` is normalized as `TotalRenders / requested
measurement duration` for every variant. Reactor's original
`reportedRendersPerSec` is retained in each raw record because its
`PerfTracker` wall clock also includes initial tree construction. Startup is
reported separately using external process-to-window timing.

## Measurement requirements

- Release builds and the same architecture for every variant.
- AC power and a fixed display refresh rate; disable Dynamic Refresh Rate.
- Keep the benchmark window visible, foreground, and unoccluded.
- Do not use RDP or switch virtual desktops during a run.
- Close unrelated applications and record the active power plan.
- Treat single runs as smoke tests only. Published results require interleaved
  repetitions and confidence intervals.

The runner rotates execution order each round:

```text
Direct -> DynWinRTJsx -> Reactor
Reactor -> Direct -> DynWinRTJsx
DynWinRTJsx -> Reactor -> Direct
```

This reduces temperature, power-state, and time-correlated ordering bias.

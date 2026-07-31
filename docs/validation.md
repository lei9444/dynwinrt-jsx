# Validation guide

The validation suite reuses the repository's existing test and UI Automation
scripts and writes one result directory containing per-step logs plus
`summary.json`.

```powershell
.\scripts\run-validation-suite.ps1 -Profile quick
.\scripts\run-validation-suite.ps1 -Profile native
.\scripts\run-validation-suite.ps1 -Profile full

# npm aliases
npm run validate:quick
npm run validate:native
npm run validate:full
npm run validate:release
```

## Profiles

| Profile | Steps |
|---|---|
| `quick` | package typecheck/tests, Gallery lifecycle/module tests |
| `native` | quick + Dashboard native selftest + Gallery Router UIA |
| `full` | native + Dashboard soak/evidence + full Gallery UIA + accessibility matrix + pinned release-set app |

Preview the plan without running commands:

```powershell
.\scripts\run-validation-suite.ps1 `
  -Profile full `
  -PlanOnly
```

Each step continues after another step fails. The suite exits nonzero after all
selected steps complete if any failed.

Pass `-SkipDesktopInput` to the unified suite for lock-safe coverage. That
mode replaces the full per-page Gallery matrix with category navigation plus
the focused Router and Motion smokes, and skips physical keyboard/double-click
checks. The normal unlocked profile retains every page interaction.

## Evidence

`summary.json` uses protocol `dynwinrt-jsx.validation-suite` and records:

- profile and commit;
- step status and exit code;
- UTC start time and duration;
- stdout/stderr log paths.

Native scripts retain their own detailed evidence directories for inspector,
heartbeat, route, UIA, hang capture, orphan-window, and final-idle data.

The release-set step writes:

- `release-set.json` with exact template specs, source commits, package
  filenames, sizes, and SHA-256 hashes;
- `compatibility.json` with the generated normal-mode manifest, installed
  versions, process result, and renderer cleanup evidence;
- an isolated npm cache and empty target directory, with no sibling junctions
  or `file:` declarations in the generated application.

## Focused commands

```powershell
npm run check
.\scripts\run-native-selftest.ps1
.\scripts\repeat-dashboard-smoke.ps1 -SkipDesktopInput
.\scripts\run-accessibility-matrix.ps1 -IncludeUIA
.\scripts\smoke-generated-app-local.ps1
.\scripts\smoke-generated-app-release.ps1
```

Use the smallest profile that proves the changed behavior. Use `full` before a
release candidate or after changing Host/Worker/window/projection lifecycle.

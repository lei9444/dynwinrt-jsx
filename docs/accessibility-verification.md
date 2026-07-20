# Accessibility verification

The repository has two automated accessibility tiers:

```powershell
.\scripts\run-native-selftest.ps1
.\scripts\run-accessibility-matrix.ps1 -IncludeUIA
```

The accessibility matrix snapshots the current user settings, runs the native
selftest and dashboard UIA workflow under these profiles, then restores the
original settings in `finally`:

- current settings
- High Contrast
- 150% text scale
- reduced motion
- restored settings

Each profile records `AccessibilitySettings`, `UISettings`, screenshots, UIA
relationships, keyboard focus order, renderer diagnostics, and process exit
status under `examples\dashboard\.winapp\accessibility-matrix`.

## Manual Narrator pass

Run this checklist on an interactive Windows desktop:

1. Start the generated application or dashboard.
2. Enable Narrator.
3. Navigate the shell using only keyboard commands.
4. Confirm navigation items announce their page names and selection state.
5. Confirm the task input announces `New task`.
6. Confirm task rows announce task names, checkbox state, and remove actions.
7. Open and close ContentDialog, Flyout, and TeachingTip.
8. Confirm focus returns to the initiating control.
9. Switch to High Contrast and repeat the primary workflow.
10. Record Windows, Node, architecture, Narrator, text-scale, and theme versions.

The automated UIA scanner verifies names, IDs, relationships, focus order, and
cleanup, but it cannot judge speech quality or announcement phrasing.

## Architecture matrix

The CI workflow is configured to run source/type/package checks on:

- Windows Server 2022 x64 with Node 22 and 24
- Windows Server 2025 x64 with Node 22 and 24
- Windows 11 ARM64 with Node 24

Real native UI verification requires an interactive desktop plus compatible
dynwinrt and winappCli artifacts. Run the native selftest and UIA matrix on a
dedicated ARM64 Windows runner before declaring ARM64 native support.

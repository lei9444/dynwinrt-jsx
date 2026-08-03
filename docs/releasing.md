# Preparing a release

The repository prepares release artifacts without publishing them:

```powershell
npm run release:prepare
```

The command:

1. runs type, runtime, documentation, and public-API baseline checks;
2. verifies that `CHANGELOG.md` contains the package version;
3. creates the npm tarball without rerunning lifecycle scripts;
4. verifies required package entry points, templates, and documentation;
5. records the tarball SHA-256, API-baseline SHA-256, source commit, dirty
   state, and tool versions in `release-manifest.json`.

Use a clean tagged checkout for a release candidate:

```powershell
.\scripts\prepare-release.ps1 `
  -OutputDirectory .winapp\release-artifact `
  -RequireCleanSources `
  -RequireTagMatch
```

`.github/workflows/release.yml` runs the same preparation for `v*` tags and
uploads the verified tarball and manifest. Actual npm publication, coordinated
publication of dynwinrt/codegen/winappCli, trusted MSIX signing, and Store
submission require external credentials and remain explicit release-owner
steps.

For the complete pinned tool set, run:

```powershell
npm run validate:release
```

For x64/ARM64 Dashboard packages and the multi-architecture bundle, use the
commands documented in `docs/sea-packaging.md`.

# Versioning and compatibility

`dynwinrt-jsx` follows semantic versioning for its supported package entry
points:

- `dynwinrt-jsx`
- `dynwinrt-jsx/core`
- `dynwinrt-jsx/controls`
- `dynwinrt-jsx/winui`
- `dynwinrt-jsx/native`
- `dynwinrt-jsx/diagnostics`
- `dynwinrt-jsx/host`
- `dynwinrt-jsx/worker`
- `dynwinrt-jsx/jsx-runtime`
- `dynwinrt-jsx/jsx-dev-runtime`

## Public API baseline

`docs/public-api-baseline.json` is the reviewed API contract for the current
package version. `npm run check` compares every public entry point, every
exported symbol, and the SHA-256 of the reachable emitted declaration graph
with that baseline.

Use `npm run api:baseline:update` only after classifying the change:

- patch: compatible behavior or type corrections that do not reject existing
  valid consumers;
- minor: additive exports, options, and capabilities;
- major: removed/renamed exports, newly required arguments, narrower accepted
  values, or changed lifecycle ownership.

Breaking or behavior-changing APIs must also update `docs/migration-v1.md` and
`CHANGELOG.md`.

## Runtime compatibility

Host and Worker code must use the same `dynwinrt-jsx` version. The state bridge
wire protocol is `dynwinrt-jsx.state.v2`; mixing framework versions across the
port is unsupported.

The validated 1.0 release set uses exact versions:

| Package | Version |
|---|---|
| `@microsoft/dynwinrt` | `0.1.0` |
| `@microsoft/dynwinrt-codegen` | `0.1.0` |
| `@microsoft/winappcli` | `1.0.0` |
| `dynwinrt-jsx` | `1.0.0` |
| `typescript` | `5.9.2` |

Do not combine a generated binding runtime with a different codegen version
unless that combination has passed the release-set and native lifecycle gates.
Applications should use the exact versions emitted by the project creator.

## Consumer upgrade procedure

1. Read `CHANGELOG.md` and the migration guide.
2. Update the complete package set together instead of upgrading only one
   projection or framework package.
3. Regenerate WinRT bindings.
4. Run the application typecheck and build.
5. Run its native lifecycle and UI Automation gates.
6. Verify persisted state with the new runtime-state validator.
7. Package, install, launch, upgrade, and uninstall using the application's
   servicing contract.

`scripts/smoke-generated-app-release.ps1` verifies creation from exact tarballs
and an isolated npm cache. Historical-version upgrade evidence requires a
previous published release set and remains a release gate rather than a source
test.

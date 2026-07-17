# Security Policy

## Supported versions

The latest minor release of each published `@earthos/*` package and the `earthos` SDK receive security fixes.

## Reporting a vulnerability

Please do not open public issues for security reports. Use GitHub private vulnerability reporting ("Report a vulnerability" under the Security tab) or email the maintainers. You will receive an acknowledgment within 72 hours and a resolution target within 14 days for confirmed issues.

## Scope notes

- EarthOS is a client-side rendering platform. The main risk surfaces are: untrusted GeoJSON/user data parsing, third-party data feeds, and the app's proxy routes (`/api/proxy/*`).
- API keys must never ship in client bundles. Providers accept an `endpoint` override so deployments can route keyed sources through their own proxy. Reports of any path that leaks a key client-side are treated as high severity.
- Plugins execute arbitrary code by design. Only install plugins you trust, exactly as with any npm dependency. The plugin registry gates on `apiVersion`, not on trust.

## Dependencies

CI runs dependency review on PRs. SBOM generation and automated audit are part of the release workflow.

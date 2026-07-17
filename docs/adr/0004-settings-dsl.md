# ADR 0004: Home-grown settings DSL over zod

**Status:** accepted

## Decision

Plugin settings use a tiny in-house schema (`defineSettings` + seven field kinds) rather than a general validation library.

## Context

Settings schemas serve two masters: validation AND automatic UI rendering (labels, units, ranges, options). A general validator covers only the first and would pin 35+ independently versioned plugins to a third-party library's semver and bundle size. The whole DSL is ~200 lines including migration support.

## Consequences

Seven field kinds cover every current plugin. New kinds are additive (renderers ignore unknown kinds gracefully). Validation is intentionally shallow: providers still validate remote DATA at the trust boundary; the DSL only guards user settings.

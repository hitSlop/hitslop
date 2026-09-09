# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's
private vulnerability reporting for the `hitslop/hitslop` repository. Include
the affected component, reproduction steps, impact, and any suggested fix.

We will acknowledge a complete report as soon as practical and coordinate a
fix and disclosure timeline with the reporter.

## Supported versions

Security fixes target the latest release on the default branch. The macOS app
is currently `1.0.x`; the iOS app and npm packages are pre-1.0 and may change
more quickly.

## Secret handling

Never commit `.env*`, `.dev.vars`, Apple `AuthKey_*.p8` files, signing keys,
provisioning profiles, or Sparkle private keys. Commit only the documented
`*.example` files with placeholders.

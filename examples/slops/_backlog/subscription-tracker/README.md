# Subscription Tracker

A violet-and-mint tracker for recurring costs and renewal dates, with a monthly
total, annual estimate, and service pause/resume controls.

```sh
bun run slops:review subscription-tracker
bun slop build examples/slops/subscription-tracker
bun slop validate examples/slops/subscription-tracker/dist/subscription-tracker.slop
```

Pausing affects tracking only. Manage actual billing with the service provider.
Sample amounts are illustrative. Currency selection does not convert amounts.

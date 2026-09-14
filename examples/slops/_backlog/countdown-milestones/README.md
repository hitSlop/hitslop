# Countdown & Milestones

A playful desk calendar for a date worth remembering.

- Edit the event name, local date, and time with Save/Cancel.
- The countdown promotes hours/minutes as the event approaches, shows Today at
  arrival, then counts calendar days since.
- Edit milestone titles directly. Use Edit steps to reorder or delete them.
- Track up to 25 milestones independently from the event date.

```sh
bun run slops:review countdown-milestones
bun test examples/slops/tests/countdown-milestones.test.ts
bun slop build examples/slops/countdown-milestones
bun slop validate examples/slops/countdown-milestones/dist/countdown-milestones.slop
```

The existing storage shape is preserved, including createdAt and unknown fields.

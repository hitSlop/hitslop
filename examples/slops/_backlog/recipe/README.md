# Recipe

A modern cookbook in white, cobalt, and tomato red, with editable ingredients,
meal photos, and focused step-by-step cooking timers.

```sh
bun run slops:review recipe
bun slop build examples/slops/recipe
bun slop validate examples/slops/recipe/dist/recipe.slop
```

The review board includes sample, empty, and long-content fixtures. Cooking
mode retains per-step countdowns, pause/reset, progress, and completion.

# Pomodoro

A tactile tomato desk timer for focus sprints and short breaks. Its cream dial
keeps the mode, time remaining, and current state together, with a single
Start/Pause/Resume button beneath it. Pausing holds the remaining time;
finishing a session leaves the next mode ready to start.

The fixed circular window is 440 × 440. Recent focus counts refer to the last
12 saved sessions, including breaks. The live countdown is transient; completed
sessions and configured durations stay in the document.

```sh
bun slop dev examples/slops/focus-timer
bun slop build examples/slops/focus-timer
bun slop validate examples/slops/focus-timer/dist/focus-timer.slop
```

Register locally with `bun slop register examples/slops/focus-timer --force`,
then create a new **Pomodoro** from hitSlop's local catalog. Registration creates
native Quick Look and Finder icon images and installs an immutable master at
`~/.hitslop/templates/focus-timer.slop`.

See `DESIGN.md` for this timer's design language and `../../../docs/presentation.md`
for the shared guide. Barlow SemiBold is bundled from the Google Fonts repository
under the SIL Open Font License; see `assets/fonts/OFL.txt`.

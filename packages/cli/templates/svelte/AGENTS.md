# hitSlop authoring

Read `manifest.json` first. Use the local `hitslop-authoring` skill for package,
storage, capture, install, and publish work. Use `hitslop-design` when creating
or revising the interface. Treat the host window as the outer object boundary
and size it for realistic default content. Preview both live and static states,
then validate, build, install a writable test copy, and publish only when ready.
Development data stays in `.hitslop/dev/stores`; source, skills, dependencies,
editable styles, secrets, and seed data never enter the runtime `.slop`.

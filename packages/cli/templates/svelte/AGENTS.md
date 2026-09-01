# hitSlop authoring

Read `manifest.json` first. Use the local `hitslop-design` skill when creating or revising the interface. Treat the host window as the outer object boundary and size it for the default content. Preview both live and static states with `bunx @hitslop/cli dev`, then run `build` and `publish`. Development data stays in `.hitslop/dev/stores`; source, skills, dependencies, and editable styles never enter the runtime `.slop`.

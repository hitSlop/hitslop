const { execFileSync } = require('node:child_process');

// One canonical discovery pass per graph refresh, including manifest and selection validation.
/** @type {import('@nx/devkit').CreateNodes} */
exports.createNodes = ['examples/slops/*/manifest.json', (files, options, context) => {
  const templates = JSON.parse(execFileSync('bun', ['scripts/nx-pilot/discover.ts'], {
    cwd: context.workspaceRoot, encoding: 'utf8',
  }));
  return templates.map(({ slug, root }) => {
    const file = `${root}/manifest.json`;
    const portable = `generated/nx-pilot/portable/${slug}`;
    const rendered = `generated/nx-pilot/rendered/${slug}`;
    return [file, { projects: { [root]: {
      name: `pilot-${slug}`, root, tags: ['nx-pilot', 'slop'],
      implicitDependencies: ['pilot-runtime'],
      targets: {
        compile: {
          command: `bun scripts/nx-pilot/compile.ts ${slug}`,
          cache: true, inputs: ['compiler', '{projectRoot}/**/*', '^runtime'],
          outputs: [`{workspaceRoot}/${portable}`],
          dependsOn: [{ projects: ['pilot-runtime'], target: 'build' }],
        },
        artwork: {
          command: `bun scripts/nx-pilot/artwork.ts ${slug}`,
          cache: true, parallelism: false,
          inputs: ['compiler', 'renderer', '{projectRoot}/**/*', '^runtime',
            { dependentTasksOutputFiles: '**/*', transitive: true }],
          outputs: [`{workspaceRoot}/${rendered}`], dependsOn: ['compile'],
        },
        verify: {
          command: `bun scripts/nx-pilot/verify.ts ${slug}`,
          cache: false, dependsOn: ['artwork'],
        },
      },
    } } }];
  });
}];

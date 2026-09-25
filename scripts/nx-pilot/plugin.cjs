const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

// Only these two real authoring projects participate in the experiment.
const slugs = ['daily-planner', 'reading-tracker'];
exports.slugs = slugs;
/** @type {import('@nx/devkit').CreateNodes} */
exports.createNodes = ['examples/slops/*/manifest.json', (files, options, context) =>
  files.flatMap(file => {
    const root = dirname(file);
    if (!slugs.includes(root.split('/').at(-1))) return [];
    const manifest = JSON.parse(readFileSync(join(context.workspaceRoot, file), 'utf8'));
    if (manifest.runtime !== 'hitslop-v1' || manifest.slug !== root.split('/').at(-1))
      throw new Error(`Invalid pilot manifest: ${file}`);
    const slug = manifest.slug;
    const portable = `generated/nx-pilot/portable/${slug}`;
    const rendered = `generated/nx-pilot/rendered/${slug}`;
    return [[file, { projects: { [root]: {
      name: `pilot-${slug}`, root, tags: ['nx-pilot'],
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
    } } }]];
  })];

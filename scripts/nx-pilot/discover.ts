import { relative } from "node:path";
import { discoverTemplates, repository } from "../v1/templates";
console.log(JSON.stringify((await discoverTemplates()).map(template => ({
  ...template, root: relative(repository, template.source),
}))));

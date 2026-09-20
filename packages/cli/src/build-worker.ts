import { buildProjectInNode } from "./build";
console.log(await buildProjectInNode(process.argv[2]!, process.argv[3]));

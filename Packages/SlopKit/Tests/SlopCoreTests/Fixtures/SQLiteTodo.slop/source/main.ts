import { ready } from "@slop/runtime";

const target = document.getElementById("app");
if (!target) throw new Error("Missing #app");
target.textContent = "SQLite fixture";

ready();

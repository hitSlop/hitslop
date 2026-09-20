#!/usr/bin/env bun
import { app } from "./app";
await app.execute({ argv: process.argv.length === 2 ? ["--help"] : process.argv.slice(2) });

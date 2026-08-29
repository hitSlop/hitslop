import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({ env: { HITSLOP_INTERNAL_SECRET: v.optional(v.string()) } });

import { z } from "zod";

export const LocalTemplateInstallSchema = z.object({
  artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
  installedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/),
}).strict().meta({ id: "LocalTemplateInstall", title: "LocalTemplateInstall" });

export type LocalTemplateInstall = z.infer<typeof LocalTemplateInstallSchema>;
export const parseLocalTemplateInstall = (input: unknown): LocalTemplateInstall => LocalTemplateInstallSchema.parse(input);

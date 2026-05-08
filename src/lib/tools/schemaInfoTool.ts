import fs from "fs";
import path from "path";
import { tool } from "ai";
import { z } from "zod";

const schemaPath = path.join(
  process.cwd(),
  "src",
  "lib",
  "tools",
  "schema-info.yaml"
);

export const schemaInfoTool = tool({
  description: `
    Returns the database schema and SQL rules in YAML.
    Call this before generating SQL or explaining schema details.
  `,
  inputSchema: z.object({}),
  execute: async () => {
    const content = fs.readFileSync(schemaPath, "utf8");
    return {
      format: "yaml",
      schema: content,
    };
  },
});

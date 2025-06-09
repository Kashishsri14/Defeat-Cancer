import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
const sql = neon(
  "postgresql://neondb_owner:npg_Ca7gVGudl6ms@ep-square-tree-a8vkb4gy-pooler.eastus2.azure.neon.tech/beat_cancer?sslmode=require"
);
export const db = drizzle(sql, { schema });
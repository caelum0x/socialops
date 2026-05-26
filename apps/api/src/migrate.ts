import { loadConfig } from "./config.js";
import { createDb, runCoreMigration } from "./db.js";

const db = createDb(loadConfig().databaseUrl);

try {
  await runCoreMigration(db);
  console.log("SocialOps core migration applied");
} finally {
  await db.close();
}

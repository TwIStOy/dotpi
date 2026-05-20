import { homedir } from "node:os";
import { join } from "node:path";

/** Directory for JSON dumps and the `.enabled` sentinel file. */
export const DEBUG_DUMP_DIR = join(homedir(), ".dotpi", "debug-dump");

/** When this file exists (contents ignored), dumping is enabled (unless env forces off). */
export const DEBUG_DUMP_ENABLED_FILE = join(DEBUG_DUMP_DIR, ".enabled");

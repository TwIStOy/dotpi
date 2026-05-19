import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  openSync,
  closeSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ScheduledSubagent, ScheduleStoreData } from "./types.js";

function encodeCwd(cwd: string): string {
  return cwd
    .replace(/[/\\]/g, "-")
    .replace(/^[A-Za-z]:-/, "")
    .replace(/^-+/, "");
}

function storeDir(cwd: string): string {
  return join(cwd, ".pi", "subagent-schedules");
}

function storePath(cwd: string): string {
  return join(storeDir(cwd), `${encodeCwd(cwd)}.json`);
}

function lockPath(cwd: string): string {
  return join(storeDir(cwd), `${encodeCwd(cwd)}.lock`);
}

export class ScheduleStore {
  private cwd: string;
  private data: ScheduleStoreData;
  private fd: number | null = null;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.data = { version: 1, jobs: [] };
  }

  load(): void {
    const path = storePath(this.cwd);
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.version === 1 && Array.isArray(parsed.jobs)) {
          this.data = parsed;
        }
      } catch {
        this.data = { version: 1, jobs: [] };
      }
    }
  }

  save(): void {
    const dir = storeDir(this.cwd);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(
      storePath(this.cwd),
      JSON.stringify(this.data, null, 2) + "\n",
      "utf-8",
    );
  }

  lock(): boolean {
    const dir = storeDir(this.cwd);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const lp = lockPath(this.cwd);
    try {
      this.fd = openSync(lp, "wx");
      writeSync(this.fd, String(process.pid));
      return true;
    } catch {
      if (existsSync(lp)) {
        try {
          const pid = parseInt(readFileSync(lp, "utf-8").trim(), 10);
          try {
            process.kill(pid, 0);
            return false;
          } catch {
            unlinkSync(lp);
            this.fd = openSync(lp, "wx");
            writeSync(this.fd, String(process.pid));
            return true;
          }
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  unlock(): void {
    if (this.fd !== null) {
      try {
        closeSync(this.fd);
      } catch {
        /* best-effort close */
      }
      this.fd = null;
    }
    try {
      unlinkSync(lockPath(this.cwd));
    } catch {
      /* best-effort cleanup */
    }
  }

  getJobs(): ScheduledSubagent[] {
    return this.data.jobs;
  }

  getEnabledJobs(): ScheduledSubagent[] {
    return this.data.jobs.filter((j) => j.enabled);
  }

  getJob(id: string): ScheduledSubagent | undefined {
    return this.data.jobs.find((j) => j.id === id);
  }

  addJob(
    job: Omit<ScheduledSubagent, "id" | "createdAt" | "runCount">,
  ): ScheduledSubagent {
    const record: ScheduledSubagent = {
      ...job,
      id: randomUUID().slice(0, 11),
      createdAt: new Date().toISOString(),
      runCount: 0,
    };
    this.data.jobs.push(record);
    this.save();
    return record;
  }

  updateJob(
    id: string,
    patch: Partial<ScheduledSubagent>,
  ): ScheduledSubagent | undefined {
    const idx = this.data.jobs.findIndex((j) => j.id === id);
    if (idx === -1) return undefined;
    Object.assign(this.data.jobs[idx], patch);
    this.save();
    return this.data.jobs[idx];
  }

  removeJob(id: string): boolean {
    const idx = this.data.jobs.findIndex((j) => j.id === id);
    if (idx === -1) return false;
    this.data.jobs.splice(idx, 1);
    this.save();
    return true;
  }

  recordRun(
    id: string,
    status: "success" | "error" | "running",
    nextRun?: string,
  ): void {
    const job = this.data.jobs.find((j) => j.id === id);
    if (!job) return;
    job.runCount++;
    job.lastRun = new Date().toISOString();
    job.lastStatus = status;
    job.nextRun = nextRun;
    this.save();
  }

  dispose(): void {
    this.unlock();
  }
}

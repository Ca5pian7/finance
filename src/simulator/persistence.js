import fs from "node:fs";
import path from "node:path";
import { runTick } from "./engine.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CHECKPOINT_FILE = path.join(DATA_DIR, "checkpoint.json");

export function saveCheckpoint(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const checkpoint = {
    tick: state.tick,
    time: state.time,
    seed: state.seed,
    state
  };
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2), "utf8");
  return CHECKPOINT_FILE;
}

export function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_FILE)) return null;
  return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8")).state;
}

export function fastForward(state, ticks) {
  for (let i = 0; i < ticks; i += 1) runTick(state);
  return state;
}

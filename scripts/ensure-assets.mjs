#!/usr/bin/env node
/**
 * ensure-assets.mjs — make sure the notes-assets checkout exists for local dev.
 *
 * The assets repo lives nested at <repo>/quartz/static/assets (same default
 * output dir as scripts/sync-assets.mjs, so `pnpm dev` needs no env vars).
 *   - checkout missing / not a git repo  -> `git clone --depth 1` it
 *   - checkout present                   -> `git pull --ff-only`
 */

import { execFileSync } from "child_process"
import { existsSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const TARGET_DIR = process.env.ASSETS_DIR || join(SCRIPT_DIR, "..", "quartz", "static", "assets")
const REMOTE = process.env.ASSETS_REPO || "https://github.com/WestRane/notes-assets.git"

function git(args, cwd) {
  return execFileSync("git", args, { cwd, stdio: "pipe", encoding: "utf-8" }).trim()
}

const hasFiles =
  existsSync(join(TARGET_DIR, "images")) || existsSync(join(TARGET_DIR, "manifest.json"))

if (!existsSync(join(TARGET_DIR, ".git"))) {
  if (existsSync(TARGET_DIR)) {
    console.warn(
      `ensure-assets: ${TARGET_DIR} exists but is not a git checkout; ` +
        `leaving it alone (move it aside to get a fresh clone).`,
    )
  } else {
    try {
      console.log(`ensure-assets: cloning ${REMOTE} ...`)
      execFileSync("git", ["clone", "--depth", "1", REMOTE, TARGET_DIR], { stdio: "inherit" })
    } catch {
      if (hasFiles) {
        console.warn("ensure-assets: clone failed, continuing with local files.")
      } else {
        console.error("ensure-assets: clone failed and no local assets exist; check your network.")
        process.exit(1)
      }
    }
  }
} else {
  try {
    const out = git(["pull", "--ff-only"], TARGET_DIR)
    if (out) console.log(`ensure-assets: ${out.split("\n").pop()}`)
    else console.log("ensure-assets: assets already up to date.")
  } catch {
    console.warn("ensure-assets: pull failed, continuing with local files.")
  }
}

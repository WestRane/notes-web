#!/usr/bin/env node
/**
 * sync-assets.mjs — download banner/poster images for reviews into the assets repo.
 *
 * Flow (per CI run):
 *   1. Scan CONTENT_DIR for reviews (files whose frontmatter `category` is known).
 *   2. Build the set of asset keys, one per usable id:
 *      `<category>-<provider>-<id>` (e.g. `anime-anilist-1396`).
 *   3. Skip keys whose images are complete and on disk (files are the cache).
 *      Incomplete keys are re-resolved only if last checked over 30 days ago.
 *   4. Resolve remaining keys through the category's chain, download, validate,
 *      process with sharp, write to ASSETS_DIR/images/banners|posters, update manifest.
 *   5. Entries for ids no longer in content are kept untouched (files stay
 *      on disk too), so restoring a deleted review needs no refetch.
 *
 * Manual images: drop a file at
 *   ASSETS_DIR/images/banners/<category>/manual-<provider>-<id>.webp
 * or
 *   ASSETS_DIR/images/posters/<category>/manual-<provider>-<id>.webp
 * (e.g. `images/banners/series/manual-imdb-tt0903747.webp`). It is adopted
 * into the manifest, never downloaded over. Each side is independent: a
 * manual banner does not stop a missing poster from being auto-fetched,
 * and vice versa.
 */

import { readdir, readFile, writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { dirname, join, posix } from "path"
import { fileURLToPath } from "url"
import matter from "gray-matter"
import sharp from "sharp"

// ---------------------------------------------------------------- config

const CONTENT_DIR = process.env.CONTENT_DIR || "content"
// Default output is the served static dir, resolved from this file's location
// so it works from any cwd (CI overrides it with the assets-repo checkout).
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = process.env.ASSETS_DIR || join(SCRIPT_DIR, "..", "quartz", "static", "assets")
const BANNERS_DIR = join(ASSETS_DIR, "images", "banners")
const POSTERS_DIR = join(ASSETS_DIR, "images", "posters")
const MANIFEST_FILE = join(ASSETS_DIR, "manifest.json")

const ANILIST_API = "https://graphql.anilist.co"
const ANILIST_DELAY_MS = 2000 // AniList allows 30 req/min
const RATE_LIMIT_RETRY_FALLBACK_S = 60

const MIN_BANNER_WIDTH = 400
const MIN_POSTER_WIDTH = 100
const BANNER_WIDTH = 1920
const POSTER_WIDTH = 800
const DOWNLOAD_CONCURRENCY = 8
// Incomplete entries are re-resolved only when their last check is older
// than this (providers might add images later).
const RECHECK_AFTER_MS = 30 * 24 * 60 * 60 * 1000

// Category -> ordered chain of resolver names. Reviews whose category is not
// here are not reviews (silently skipped).
const CHAINS = {
  anime: ["anilist"],
  manga: ["anilist"],
  ranobe: ["anilist"],
  series: ["imdb"],
  movies: ["imdb"],
  games: ["steam"],
  books: ["openlibrary"],
}

// Id keys that can never resolve to an image (kept for metadata only).
const INERT_KEYS = new Set(["mal", "igdb", "tmdb", "goodreads"])

const ANILIST_QUERY = `
  query ($id: Int) {
    Media(id: $id) {
      bannerImage
      coverImage { extraLarge large }
    }
  }
`

// ---------------------------------------------------------------- util

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()
const warn = (file, msg, level = "warning") => console.log(`::${level} file=${file}::${msg}`)

async function findMarkdownFiles(dir) {
  const out = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === "index.md") continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await findMarkdownFiles(full)))
    else if (entry.name.endsWith(".md")) out.push(full)
  }
  return out
}

async function downloadImage(url, timeoutMs = 15000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (res.status !== 200) return { ok: false, reason: `HTTP ${res.status}` }
  const type = res.headers.get("content-type") || ""
  if (!type.startsWith("image/")) return { ok: false, reason: `content-type ${type}` }
  return { ok: true, buffer: Buffer.from(await res.arrayBuffer()) }
}

async function processImage(buffer, { width, minWidth, quality, outPath }) {
  const meta = await sharp(buffer).metadata()
  if (!meta.width || meta.width < minWidth) {
    return { ok: false, reason: `too narrow (${meta.width ?? 0}px)` }
  }
  await sharp(buffer).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(outPath)
  return { ok: true }
}

// ---------------------------------------------------------------- resolvers
// Each takes the review's ids object and returns { banner?, poster? } URLs
// (null when it has nothing to offer). Validation happens at download time,
// so guessing a URL that may 404 (e.g. metahub poster) is safe.

async function resolveAnilist(ids) {
  const id = Number(ids.anilist)
  if (!id) return null
  while (true) {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { id } }),
      signal: AbortSignal.timeout(30000),
    })
    if (res.status === 429) {
      const wait = Number(res.headers.get("Retry-After")) || RATE_LIMIT_RETRY_FALLBACK_S
      console.log(`  rate limited, waiting ${wait}s...`)
      await sleep(wait * 1000)
      continue
    }
    if (!res.ok) throw new Error(`AniList HTTP ${res.status} for id ${id}`)
    const media = (await res.json())?.data?.Media
    if (!media) return { banner: null, poster: null }
    return {
      banner: media.bannerImage ?? null,
      poster: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    }
  }
}

function resolveSteam(ids) {
  if (!ids.steam) return null
  const app = String(ids.steam)
  return {
    banner: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${app}/library_hero.jpg`,
    poster: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${app}/library_600x900.jpg`,
  }
}

function resolveImdb(ids) {
  if (!ids.imdb) return null
  const imdb = String(ids.imdb)
  return {
    banner: `https://images.metahub.space/background/medium/${imdb}/img`,
    poster: `https://images.metahub.space/poster/medium/${imdb}/img`,
  }
}

function resolveOpenLibrary(ids) {
  const ol = ids.openlibrary ? String(ids.openlibrary) : null
  const isbn = ids.isbn ? String(ids.isbn) : null
  const url = ol
    ? `https://covers.openlibrary.org/b/olid/${ol}-L.jpg?default=false`
    : isbn
      ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
      : null
  if (!url) return null
  return { banner: null, poster: url } // books render the poster hero (book cover), no banner
}

const RESOLVERS = {
  anilist: resolveAnilist,
  steam: resolveSteam,
  imdb: resolveImdb,
  openlibrary: resolveOpenLibrary,
}

let anilistGate = Promise.resolve()
function resolveAnilistGated(ids) {
  const run = anilistGate.then(async () => {
    try {
      return await RESOLVERS.anilist(ids)
    } finally {
      await sleep(ANILIST_DELAY_MS)
    }
  })
  anilistGate = run.catch(() => {})
  return run
}

// ---------------------------------------------------------------- main

async function main() {
  if (!existsSync(CONTENT_DIR)) {
    console.error(`Content dir not found: ${CONTENT_DIR}`)
    process.exit(1)
  }
  for (const dir of [ASSETS_DIR, BANNERS_DIR, POSTERS_DIR]) {
    try {
      await mkdir(dir, { recursive: true })
    } catch (err) {
      console.error(`Cannot write assets dir ${dir}: ${err.message}`)
      process.exit(1)
    }
  }

  let manifest = { images: {} }
  if (existsSync(MANIFEST_FILE)) {
    try {
      const parsed = JSON.parse(await readFile(MANIFEST_FILE, "utf-8"))
      if (parsed && typeof parsed.images === "object" && parsed.images !== null) {
        manifest = { ...parsed, images: parsed.images }
      } else {
        console.warn(`Ignoring ${MANIFEST_FILE}: expected { \"images\": {...} }. Starting empty.`)
      }
      console.log(`Loaded manifest: ${Object.keys(manifest.images).length} entries`)
    } catch (err) {
      console.warn(`Failed to parse ${MANIFEST_FILE}: ${err.message}. Starting empty.`)
    }
  }

  // Manifest is saved progressively (every 25 keys) so an interrupted run
  // keeps its progress; a final save happens at the end.
  let saveGate = Promise.resolve()
  function saveManifest() {
    saveGate = saveGate
      .then(() => writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n"))
      .catch((err) => console.warn(`manifest save failed: ${err.message}`))
    return saveGate
  }

  // -- scan reviews -------------------------------------------------------
  // Only reviews need assets; sibling folders (templates, index notes, ...) are never scanned.
  const scanDir = existsSync(join(CONTENT_DIR, "reviews"))
    ? join(CONTENT_DIR, "reviews")
    : CONTENT_DIR
  const files = await findMarkdownFiles(scanDir)
  console.log(`Scanning ${files.length} markdown files...`)

  // key -> { category, provider, id, file, ids, kind }
  const wanted = new Map()
  let skippedNonReview = 0

  for (const file of files) {
    let data
    try {
      data = matter((await readFile(file, "utf-8")).slice(0, 8192)).data
    } catch {
      continue
    }
    const rel = posix.join(
      CONTENT_DIR,
      file.split(CONTENT_DIR).pop().replace(/\\/g, "/").replace(/^\//, ""),
    )
    const category = data.category
    const chain = CHAINS[category]
    if (!chain) {
      skippedNonReview++
      continue
    }

    const rawTags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []
    const kind = ["review", "note", "log"].find((t) => rawTags.map(String).includes(t)) ?? "other"

    const ids = data.ids
    if (!ids || typeof ids !== "object") {
      warn(rel, "review has no ids, no images will be fetched")
      continue
    }
    let usable = false
    for (const provider of chain) {
      const value = ids[provider]
      if (value === undefined || value === null || String(value).trim() === "") continue
      usable = true
      const key = `${category}-${provider}-${String(value).trim()}`
      if (!wanted.has(key)) {
        wanted.set(key, { category, provider, id: String(value).trim(), file: rel, ids, kind })
      }
    }
    if (!usable) {
      const inert = Object.keys(ids).filter((k) => INERT_KEYS.has(k))
      warn(
        rel,
        inert.length > 0
          ? `no fetchable id for category "${category}" (only ${inert.join(", ")}, which need API keys)`
          : `no usable id for category "${category}", no images will be fetched`,
      )
    }
  }
  console.log(
    `Found ${wanted.size} asset keys in content (${skippedNonReview} non-review files skipped)`,
  )

  // -- fetch provider images (parallel; image CDNs don't rate-limit) --------
  let fetched = 0

  const keys = [...wanted.keys()]
  let doneCount = 0

  async function processKey(key) {
    const { category, provider, id, ids, file } = wanted.get(key)
    const entry = manifest.images[key]
    const n = ++doneCount
    const tag = `[${n}/${keys.length}] ${key}`
    // Manual overrides: images/banners|posters/<category>/manual-<provider>-<id>.webp
    // files are adopted into the manifest and never downloaded over.
    const manual = {
      banner: posix.join(category, `manual-${provider}-${id}.webp`),
      poster: posix.join(category, `manual-${provider}-${id}.webp`),
    }
    const manualExists = {
      banner: existsSync(join(BANNERS_DIR, manual.banner)),
      poster: existsSync(join(POSTERS_DIR, manual.poster)),
    }
    const bannerFileOk = !!(entry && entry.banner && existsSync(join(BANNERS_DIR, entry.banner)))
    const posterFileOk = !!(entry && entry.poster && existsSync(join(POSTERS_DIR, entry.poster)))
    const bannerOk = bannerFileOk || manualExists.banner
    const posterOk = posterFileOk || manualExists.poster
    const isComplete = posterOk && (category === "books" || bannerOk)
    const checkedAt = entry?.checkedAt ? Date.parse(entry.checkedAt) : NaN
    const recheckDue = !entry || Number.isNaN(checkedAt) || Date.now() - checkedAt > RECHECK_AFTER_MS
    const manualAdopted =
      (!manualExists.banner || entry?.banner === manual.banner) &&
      (!manualExists.poster || entry?.poster === manual.poster)

    if (entry && (isComplete || !recheckDue) && manualAdopted) {
      return
    }

    const notes = []
    try {
      let resolved
      if (provider === "anilist") {
        resolved = await resolveAnilistGated(ids)
      } else {
        resolved = await RESOLVERS[provider](ids)
      }
      if (!resolved || (!resolved.banner && !resolved.poster)) {
        manifest.images[key] = { banner: null, poster: null, source: provider, checkedAt: now() }
        console.log(`${tag} no image offered`)
        return
      }

      const next = { banner: null, poster: null, source: provider, checkedAt: now() }
      for (const kind of ["banner", "poster"]) {
        if (manualExists[kind]) {
          next[kind] = manual[kind]
          continue
        }
        const url = resolved[kind]
        if (!url) continue
        const dir = kind === "banner" ? BANNERS_DIR : POSTERS_DIR
        await mkdir(join(dir, category), { recursive: true })
        const subPath = posix.join(category, `${provider}-${id}.webp`)
        const outPath = join(dir, subPath)
        if (existsSync(outPath)) {
          next[kind] = subPath
          continue
        }
        const dl = await downloadImage(url)
        if (!dl.ok) {
          notes.push(`${kind} unavailable (${dl.reason})`)
          continue
        }
        const r = await processImage(dl.buffer, {
          width: kind === "banner" ? BANNER_WIDTH : POSTER_WIDTH,
          minWidth: kind === "banner" ? MIN_BANNER_WIDTH : MIN_POSTER_WIDTH,
          quality: 80,
          outPath,
        })
        if (!r.ok) {
          notes.push(`${kind} rejected (${r.reason})`)
          continue
        }
        next[kind] = subPath
      }

      manifest.images[key] = next
      fetched++
      if (fetched % 25 === 0) await saveManifest()
      const extra = notes.length > 0 ? ` [${notes.join("; ")}]` : ""
      if (next.banner || next.poster) {
        const label = (v) => (v ? (v.includes("/manual-") ? "manual" : true) : false)
        console.log(`${tag} ok (banner: ${label(next.banner)}, poster: ${label(next.poster)})${extra}`)
      } else {
        console.log(`${tag} no usable image${extra}`)
      }
    } catch (err) {
      console.log(`${tag} failed: ${err.message}`)
      warn(file, `${key}: fetch failed (${err.message}), will retry on a later run`)
    }
  }

  {
    let idx = 0
    const runWorker = async () => {
      while (true) {
        const i = idx++
        if (i >= keys.length) return
        await processKey(keys[i])
      }
    }
    const workers = Math.min(DOWNLOAD_CONCURRENCY, Math.max(keys.length, 1))
    await Promise.all(Array.from({ length: workers }, runWorker))
  }

  // Manifest entries for ids that left the content are kept as-is (files stay
  // on disk too), so restoring a deleted review needs no refetch.

  await saveManifest()
  const withBanner = Object.values(manifest.images).filter((e) => e.banner).length
  const withPoster = Object.values(manifest.images).filter((e) => e.poster).length
  console.log(
    `\nDone: ${fetched} fetched, manifest has ${Object.keys(manifest.images).length} entries ` +
      `(${withBanner} with banner, ${withPoster} with poster).`,
  )
  
  // Report every gap on every run (reporting is always fresh; re-resolution
  // of stale gaps happens only when their last check is over 30 days old)
  const incomplete = []
  const withoutImages = []
  for (const [key, { category, file, kind }] of wanted) {
    const entry = manifest.images[key]
    if (!entry) continue // failed this run, already warned inline
    if (!entry.banner && !entry.poster) {
      withoutImages.push({ key, file, kind })
    } else {
      if (!entry.banner && category !== "books")
        incomplete.push({ key, file, kind, what: "banner" })
      if (!entry.poster) incomplete.push({ key, file, kind, what: "poster" })
    }
  }
  for (const kind of ["review", "note", "log", "other"]) {
    const items = incomplete.filter((g) => g.kind === kind)
    if (items.length === 0) continue
    console.log(`\nIncomplete images [${kind}]:`)
    const byFile = new Map()
    for (const { key, file, what } of items) {
      if (!byFile.has(file)) byFile.set(file, [])
      byFile.get(file).push(`${key} (no ${what})`)
    }
    for (const [f, ks] of byFile) warn(f, `[${kind}] incomplete images for ${ks.join(", ")}`)
  }
  for (const kind of ["review", "note", "log", "other"]) {
    const items = withoutImages.filter((g) => g.kind === kind)
    if (items.length === 0) continue
    console.log(`\nWithout images [${kind}] (rechecked when 30+ days stale):`)
    const byFile = new Map()
    for (const { key, file } of items) {
      if (!byFile.has(file)) byFile.set(file, [])
      byFile.get(file).push(key)
    }
    for (const [f, ks] of byFile) warn(f, `[${kind}] no images found for ${ks.join(", ")}`, "error")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

import { readdir, readFile, writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"

const CACHE_FILE = "quartz/static/data/anilist.json"
const CONTENT_DIR = "content"
const ANILIST_API = "https://graphql.anilist.co"
const DELAY_MS = 500
const MAX_REFETCH = 25
const TTL_MS = 30 * 24 * 60 * 60 * 1000

const query = `
  query ($id: Int) {
    Media(id: $id) {
      bannerImage
      coverImage {
        extraLarge
        large
      }
    }
  }
`

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAnilistMedia(id) {
  while (true) {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { id } }),
    })

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "60")
      console.log(`  Rate limited. Waiting ${retryAfter}s...`)
      await sleep(retryAfter * 1000)
      continue
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    return data?.data?.Media ?? null
  }
}

async function findMarkdownFiles(dir) {
  const files = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findMarkdownFiles(fullPath)))
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath)
    }
  }
  return files
}

async function extractAnilistId(filePath) {
  const content = await readFile(filePath, "utf-8")
  const match = content.match(/anilist:\s*(\d+)/)
  return match ? parseInt(match[1]) : null
}

async function main() {
  let cache = {}
  if (existsSync(CACHE_FILE)) {
    const raw = await readFile(CACHE_FILE, "utf-8")
    cache = JSON.parse(raw)
    console.log(`Loaded cache: ${Object.keys(cache).length} entries`)
  }

  const files = await findMarkdownFiles(CONTENT_DIR)
  const ids = new Set()

  for (const file of files) {
    const id = await extractAnilistId(file)
    if (id) ids.add(id)
  }

  console.log(`Found ${ids.size} AniList IDs in content`)

  const newIds = [...ids].filter((id) => !cache[id])

  const staleIds = [...ids].filter(
    (id) => cache[id] && Date.now() - (cache[id].fetchedAt ?? 0) > TTL_MS
  )

  const staleWithNull = staleIds
    .filter((id) => !cache[id].banner || !cache[id].cover)
    .sort((a, b) => (cache[a].fetchedAt ?? 0) - (cache[b].fetchedAt ?? 0))

  const staleComplete = staleIds
    .filter((id) => cache[id].banner && cache[id].cover)
    .sort((a, b) => (cache[a].fetchedAt ?? 0) - (cache[b].fetchedAt ?? 0))

  const toFetch = [...newIds, ...staleWithNull, ...staleComplete].slice(0, MAX_REFETCH)
  console.log(`Fetching ${toFetch.length} IDs (${newIds.length} new, ${Math.min(staleIds.length, MAX_REFETCH - newIds.length)} stale)...`)

  for (let i = 0; i < toFetch.length; i++) {
    const id = toFetch[i]
    console.log(`  Fetching id ${id}...`)
    try {
      const media = await fetchAnilistMedia(id)
      cache[id] = {
        fetchedAt: Date.now(),
        banner: media?.bannerImage ?? null,
        cover: media?.coverImage?.extraLarge ?? media?.coverImage?.large ?? null,
      }
      console.log(`  ✓ banner: ${!!cache[id].banner}, cover: ${!!cache[id].cover}`)
    } catch (err) {
      console.error(`  ✗ Failed for id ${id}:`, err.message)
    }
    if (i < toFetch.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  await mkdir("quartz/static/data", { recursive: true })
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2))
  console.log(`Saved cache: ${Object.keys(cache).length} entries → ${CACHE_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

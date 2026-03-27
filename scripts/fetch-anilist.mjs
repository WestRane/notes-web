import { readdir, readFile, writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"

const CACHE_FILE = "public/data/anilist-images.json"
const CONTENT_DIR = "content"
const ANILIST_API = "https://graphql.anilist.co"
const DELAY_MS = 500

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
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id } }),
  })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "60")
    console.log(`  Rate limited. Waiting ${retryAfter}s...`)
    await sleep(retryAfter * 1000)
    return fetchAnilistMedia(id)
  }

  const data = await res.json()
  return data?.data?.Media ?? null
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
  console.log(`Fetching ${newIds.length} new IDs...`)

  for (const id of newIds) {
    console.log(`  Fetching id ${id}...`)
    try {
      const media = await fetchAnilistMedia(id)
      cache[id] = {
        banner: media?.bannerImage ?? null,
        cover: media?.coverImage?.extraLarge ?? media?.coverImage?.large ?? null,
      }
      console.log(`  ✓ banner: ${!!cache[id].banner}, cover: ${!!cache[id].cover}`)
    } catch (err) {
      console.error(`  ✗ Failed for id ${id}:`, err.message)
      cache[id] = { banner: null, cover: null }
    }
    if (newIds.indexOf(id) < newIds.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  await mkdir("public/data", { recursive: true })
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2))
  console.log(`Saved cache: ${Object.keys(cache).length} entries → ${CACHE_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

import { readdir, readFile, writeFile, mkdir } from "fs/promises"
import { existsSync, createReadStream } from "fs"
import { join } from "path"
import readline from "readline"

const CACHE_FILE = "quartz/static/data/anilist.json"
const CONTENT_DIR = "content"
const ANILIST_API = "https://graphql.anilist.co"
const DELAY_MS = 500
const MAX_REFETCH = 25

// Scanning & Parsing Configuration
const MAX_FRONT_MATTER_LINES = 30
const FILE_SCAN_CONCURRENCY = 10

// API Request Configuration
const RATE_LIMIT_RETRY_FALLBACK_S = 60

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
      const retryAfter = parseInt(res.headers.get("Retry-After") || RATE_LIMIT_RETRY_FALLBACK_S)
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
  const fileStream = createReadStream(filePath, { encoding: "utf-8" })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  try {
    let lineCount = 0
    for await (const line of rl) {
      lineCount++
      const match = line.match(/anilist:\s*(\d+)/)
      if (match) {
        return parseInt(match[1])
      }
      if (lineCount >= MAX_FRONT_MATTER_LINES) {
        break
      }
    }
  } finally {
    rl.close()
    fileStream.destroy()
  }
  return null
}

async function limitConcurrency(tasks, limit) {
  const results = []
  const executing = new Set()
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task())
    results.push(p)
    executing.add(p)
    const clean = () => executing.delete(p)
    p.then(clean, clean)
    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }
  return Promise.all(results)
}

async function isUrlAlive(url) {
  if (!url) return false
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) })
    return res.status === 200
  } catch {
    // If the check itself fails, assume it is fine to avoid false-positive refetches
    return true
  }
}

async function main() {
  const args = process.argv.slice(2)
  const forceAll = args.includes("--force")
  const checkOnly = args.includes("--check")
  const forceIds = args
    .filter((a) => /^\d+$/.test(a))
    .map(Number)

  let cache = {}
  if (existsSync(CACHE_FILE)) {
    try {
      const raw = await readFile(CACHE_FILE, "utf-8")
      cache = JSON.parse(raw)
      console.log(`Loaded cache: ${Object.keys(cache).length} entries`)
    } catch (err) {
      console.warn(`Failed to parse cache file: ${err.message}. Initializing empty cache.`)
    }
  }

  const files = await findMarkdownFiles(CONTENT_DIR)
  const idsInContent = new Set()

  console.log(`Scanning ${files.length} markdown files for AniList IDs...`)
  const ids = await limitConcurrency(
    files.map((file) => () => extractAnilistId(file)),
    FILE_SCAN_CONCURRENCY
  )

  for (const id of ids) {
    if (id) idsInContent.add(id)
  }

  console.log(`Found ${idsInContent.size} AniList IDs in content`)

  let toFetch = []

  if (forceAll) {
    toFetch = [...idsInContent]
  } else {
    // 1. New IDs (not in cache)
    const newIds = [...idsInContent].filter((id) => !cache[id])
    toFetch.push(...newIds)

    // 2. Explicitly requested force IDs
    for (const id of forceIds) {
      if (!toFetch.includes(id)) {
        toFetch.push(id)
      }
    }
    // 3. If checking, find broken URLs in the cache
    if (checkOnly) {
      console.log("Checking cached image URLs for broken links...")
      const checkTasks = []
      const cacheIds = Object.keys(cache).map(Number).filter((id) => idsInContent.has(id))
      let checkedCount = 0
      const totalEntries = cacheIds.length

      for (const id of cacheIds) {
        const entry = cache[id]
        checkTasks.push(async () => {
          const bannerAlive = entry.banner ? await isUrlAlive(entry.banner) : true
          const coverAlive = entry.cover ? await isUrlAlive(entry.cover) : true
          
          checkedCount++
          if (checkedCount % 50 === 0 || checkedCount === totalEntries) {
            console.log(`Progress: Checked ${checkedCount}/${totalEntries} cached entries...`)
          }

          if (!bannerAlive || !coverAlive) {
            return id
          }
          return null
        })
      }

      const checkResults = await limitConcurrency(checkTasks, 20)
      const brokenIds = checkResults.filter((id) => id !== null)

      if (brokenIds.length > 0) {
        console.log(`Found ${brokenIds.length} broken image URLs. Adding to fetch queue.`)
        for (const id of brokenIds) {
          if (!toFetch.includes(id)) {
            toFetch.push(id)
          }
        }
      } else {
        console.log("All cached image URLs are alive!")
      }
    }
  }

  if (toFetch.length === 0) {
    console.log("No new or broken IDs to fetch.")
    return
  }

  const bypassLimit = forceAll || checkOnly
  const toFetchBatch = bypassLimit ? toFetch : toFetch.slice(0, MAX_REFETCH)
  const remainingTotal = bypassLimit ? 0 : Math.max(0, toFetch.length - MAX_REFETCH)

  console.log(`\n--- Batch Info ---`)
  console.log(`Processing: ${toFetchBatch.length} IDs`)
  if (remainingTotal > 0) {
    console.log(`Queue: ${remainingTotal} IDs left for next run`)
  } else {
    console.log(`Queue: All clear!`)
  }
  console.log(`------------------\n`)

  const dataDir = CACHE_FILE.substring(0, CACHE_FILE.lastIndexOf('/'))
  await mkdir(dataDir, { recursive: true })

  for (let i = 0; i < toFetchBatch.length; i++) {
    const id = toFetchBatch[i]
    process.stdout.write(`[${i + 1}/${toFetchBatch.length}] Fetching id ${id}... `)
    
    try {
      const media = await fetchAnilistMedia(id)
      cache[id] = {
        banner: media?.bannerImage ?? null,
        cover: media?.coverImage?.extraLarge ?? media?.coverImage?.large ?? null,
      }
      console.log(`✓ (Banner: ${!!cache[id].banner}, Cover: ${!!cache[id].cover})`)
      
      // Save cache progressively after each successful fetch
      await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2))
    } catch (err) {
      console.log(`\n✗ Failed for id ${id}: ${err.message}`)
    }

    if (i < toFetchBatch.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\nSuccess: ${Object.keys(cache).length} entries saved to ${CACHE_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

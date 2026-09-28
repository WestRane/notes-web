import manifestData from "../../static/assets/manifest.json"

// Lookup order per category. Mirror of CHAINS in scripts/sync-assets.mjs
// (that script is the source of truth; this only decides which manifest
// entry wins when a review carries several usable ids).
export const ASSET_CHAINS: Record<string, string[]> = {
  anime: ["anilist"],
  manga: ["anilist"],
  ranobe: ["anilist"],
  series: ["imdb"],
  movies: ["imdb"],
  games: ["steam"],
  books: ["openlibrary"],
}

interface ManifestEntry {
  banner: string | null
  poster: string | null
}

export interface SourceCredit {
  name: string
  url: string
}

// Human credit per provider behind a manifest key.
const SOURCE_CREDIT: Record<string, SourceCredit> = {
  anilist: { name: "AniList", url: "https://anilist.co" },
  steam: { name: "Steam", url: "https://store.steampowered.com" },
  imdb: { name: "IMDb", url: "https://www.imdb.com" },
  openlibrary: { name: "Open Library", url: "https://openlibrary.org" },
}

type Ids = Record<string, string | number>

const images: Record<string, ManifestEntry> =
  (manifestData as { images?: Record<string, ManifestEntry> }).images ?? {}

// First banner found wins, first poster found wins (they may come from
// different entries). Manual files adopted by the sync script already sit
// in entry.banner/entry.poster, so they win with no special-casing here.
// Internal lookup also records which provider supplied each side, so the
// component can credit the exact source. Manual files adopted by the sync
// script sit in the entries; they are user-supplied, so they get no credit.
interface FoundEntry extends ManifestEntry {
  bannerBy: string | null
  posterBy: string | null
}

function findEntry(category: string, ids: Ids): FoundEntry | null {
  const providers = ASSET_CHAINS[category] ?? Object.keys(ids)
  let banner: string | null = null
  let poster: string | null = null
  let bannerBy: string | null = null
  let posterBy: string | null = null
  for (const provider of providers) {
    const value = ids[provider]
    if (value === undefined || value === null || String(value).trim() === "") continue
    const entry = images[`${category}-${provider}-${String(value).trim()}`]
    if (!entry) continue
    if (!banner && entry.banner) {
      banner = entry.banner
      bannerBy = provider
    }
    if (!poster && entry.poster) {
      poster = entry.poster
      posterBy = provider
    }
    if (banner && poster) break
  }
  if (!banner && !poster) return null
  return { banner, poster, bannerBy, posterBy }
}

export function reviewBannerUrl(category: string | undefined, ids: Ids | undefined): string | null {
  if (!category || !ids) return null
  const found = findEntry(category, ids)
  return found?.banner ? `/static/assets/images/banners/${found.banner}` : null
}

export function reviewPosterUrl(category: string | undefined, ids: Ids | undefined): string | null {
  if (!category || !ids) return null
  const found = findEntry(category, ids)
  return found?.poster ? `/static/assets/images/posters/${found.poster}` : null
}

export function reviewBannerCredit(
  category: string | undefined,
  ids: Ids | undefined,
): SourceCredit | null {
  if (!category || !ids) return null
  const found = findEntry(category, ids)
  if (!found?.banner || !found.bannerBy) return null
  if (found.banner.includes("/manual-")) return null
  return SOURCE_CREDIT[found.bannerBy] ?? null
}

export function reviewPosterCredit(
  category: string | undefined,
  ids: Ids | undefined,
): SourceCredit | null {
  if (!category || !ids) return null
  const found = findEntry(category, ids)
  if (!found?.poster || !found.posterBy) return null
  if (found.poster.includes("/manual-")) return null
  return SOURCE_CREDIT[found.posterBy] ?? null
}

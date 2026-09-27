import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import style from ".././styles/custom/bannerImage.scss"

import anilistData from "../../static/data/anilist.json"

interface RawFrontmatter {
  category?: string
  ids?: Record<string, string | number>
}

const openlibraryCover = (ids: Record<string, string | number>) => {
  const ol = ids.openlibrary
  if (ol) return `https://covers.openlibrary.org/b/olid/${ol}-L.jpg`
  const isbn = ids.isbn
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
  return null
}

const providers = {
  anilist: (id: string | number) => {
    const entry = (anilistData as Record<string, { banner?: string }>)[String(id)]
    return entry?.banner || null
  },
  steam: (id: string | number) => {
    return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_hero.jpg`
  },
  imdb: (id: string | number) => {
    return id ? `https://images.metahub.space/background/medium/${id}/img` : null
  },
}

const BannerImage: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const frontmatter = fileData.frontmatter as RawFrontmatter | undefined
  const ids = frontmatter?.ids

  if (!ids) return null

  if (frontmatter?.category === "books") {
    const coverUrl = openlibraryCover(ids)
    if (!coverUrl) return null

    return (
      <div class="banner-image book-hero loaded gated" data-cover={coverUrl}>
        <div class="book-hero-bg" style={`background-image: url(${coverUrl})`}></div>
        <div class="book-hero-dim"></div>
        <img class="book-hero-cover" src={coverUrl} alt="" loading="eager" fetchpriority="high" />
        <noscript>
          <style>
            {
              ".book-hero.gated .book-hero-bg{opacity:.7}.book-hero.gated .book-hero-cover,.book-hero.gated .book-hero-dim{opacity:1}.book-hero.gated::after{opacity:.16}"
            }
          </style>
        </noscript>
      </div>
    )
  }

  let bannerUrl: string | null = null
  let activeProvider: string | null = null
  let activeId: string | null = null

  for (const [provider, id] of Object.entries(ids)) {
    if (provider in providers && id) {
      bannerUrl = providers[provider as keyof typeof providers](id)
      activeProvider = provider
      activeId = String(id)
      if (bannerUrl) break
    }
  }

  if (!activeProvider || !activeId) return null

  const innerStyle = bannerUrl ? `background-image: url(${bannerUrl})` : ""

  return (
    <div
      class={`banner-image${bannerUrl ? " loaded" : ""}`}
      id="banner-image-root"
      data-provider={activeProvider}
      data-provider-id={activeId}
      data-banner={bannerUrl ?? ""}
      style={!bannerUrl ? "display:none" : ""}
    >
      <div class="banner-image-inner" id="banner-image-inner" style={innerStyle}></div>
    </div>
  )
}

BannerImage.css = style

BannerImage.afterDOMLoaded = `
(function() {
  let anilistCache = null;

  async function getAnilistCache() {
    if (anilistCache) return anilistCache;
    try {
      const res = await fetch("/static/data/anilist.json");
      anilistCache = await res.json();
    } catch (e) {
      anilistCache = {};
    }
    return anilistCache;
  }

  async function getBannerUrl(provider, id) {
    if (provider === 'anilist') {
      const cache = await getAnilistCache();
      return cache[id]?.banner;
    }
    if (provider === 'steam') {
      return "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/" + id + "/library_hero.jpg";
    }
    if (provider === 'imdb') {
      return "https://images.metahub.space/background/medium/" + id + "/img";
    }
    return null;
  }

  function preload(src) {
    return new Promise((resolve) => {
      let settled = false
      const done = (ok) => {
        if (!settled) {
          settled = true
          resolve(ok)
        }
      }
      const img = new Image()
      img.onload = () => done(true)
      img.onerror = () => done(false)
      img.src = src
      if (img.complete && img.naturalWidth > 0) done(true)
      setTimeout(() => done(false), 10000)
    })
  }

  async function initClassic() {
    const root = document.getElementById("banner-image-root")
    if (!root) return

    const inner = document.getElementById("banner-image-inner")
    if (!inner) return

    let url = root.dataset.banner || null

    if (!url) {
      const provider = root.dataset.provider
      const id = root.dataset.providerId
      if (!provider || !id) return

      url = await getBannerUrl(provider, id)

      if (!url) {
        root.style.display = "none"
        return
      }

      inner.style.backgroundImage = 'url("' + url + '")'
    }

    root.style.display = ""
    root.classList.add("gated")
    const ok = await preload(url)
    if (!ok) {
      root.style.display = "none"
      return
    }
    root.classList.remove("gated")
    root.classList.add("loaded", "ready")
  }

  async function initBooks() {
    const heroes = document.querySelectorAll(".book-hero[data-cover]")
    for (const hero of heroes) {
      const cover = hero.getAttribute("data-cover")
      if (!cover) continue

      // Hot asset: reveal instantly with no fade. Cold asset: keep the
      // gentle fade-in while it downloads. 80ms splits the two reliably:
      // cache hits resolve well under a frame budget, network never does.
      const SLOW = "slow"
      const result = await Promise.race([
        preload(cover),
        new Promise((resolve) => setTimeout(() => resolve(SLOW), 80)),
      ])
      if (result === SLOW) {
        const ok = await preload(cover)
        if (!ok) {
          hero.style.display = "none"
          continue
        }
        hero.classList.remove("gated")
        hero.classList.add("ready")
      } else {
        if (!result) {
          hero.style.display = "none"
          continue
        }
        hero.classList.add("no-anim")
        hero.classList.remove("gated")
        hero.classList.add("ready")
      }
    }
  }

  function init() {
    initClassic()
    initBooks()
  }

  document.addEventListener("nav", init);
  init();
})();
`

export default (() => BannerImage) satisfies QuartzComponentConstructor

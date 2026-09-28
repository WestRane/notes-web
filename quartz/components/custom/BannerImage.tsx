import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import style from ".././styles/custom/bannerImage.scss"
import {
  reviewBannerCredit,
  reviewBannerUrl,
  reviewPosterCredit,
  reviewPosterUrl,
} from "./reviewAssets"

interface RawFrontmatter {
  category?: string
  ids?: Record<string, string | number>
}

const BannerImage: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const frontmatter = fileData.frontmatter as RawFrontmatter | undefined
  const category = frontmatter?.category
  const ids = frontmatter?.ids

  if (!category || !ids) return null

  const bannerUrl = reviewBannerUrl(category, ids)
  if (bannerUrl) {
    const credit = reviewBannerCredit(category, ids)
    return (
      <>
        <div class="banner-image loaded" id="banner-image-root" data-banner={bannerUrl}>
          <div
            class="banner-image-inner"
            id="banner-image-inner"
            style={`background-image: url(${bannerUrl})`}
          ></div>
        </div>
        {credit && (
          <div class="banner-credit">
            Banner via <a href={credit.url}>{credit.name}</a>
          </div>
        )}
      </>
    )
  }

  // Fallback: poster hero, the same treatment books always get. Every review
  // without a banner lands here (books have no banner slot, so they always do
  // unless a manual banner was provided).
  const coverUrl = reviewPosterUrl(category, ids)
  if (!coverUrl) return null
  const credit = reviewPosterCredit(category, ids)

  return (
    <>
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
      {credit && (
        <div class="banner-credit">
          Poster via <a href={credit.url}>{credit.name}</a>
        </div>
      )}
    </>
  )
}

BannerImage.css = style

BannerImage.afterDOMLoaded = `
(function() {
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

    const url = root.dataset.banner || null
    if (!url) return

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

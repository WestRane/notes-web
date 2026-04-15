import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import style from ".././styles/custom/bannerImage.scss"

import anilistData from "../../static/data/anilist.json"

interface RawFrontmatter {
  ids?: Record<string, string | number>
}

const providers = {
  anilist: (id: string | number) => {
    const entry = (anilistData as Record<string, { banner?: string }>)[String(id)]
    return entry?.banner || null
  },
  steam: (id: string | number) => {
    return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_hero.jpg`
  }
}

const BannerImage: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const frontmatter = fileData.frontmatter as RawFrontmatter | undefined
  const ids = frontmatter?.ids

  if (!ids) return null

  let bannerUrl: string | null = null
  let activeProvider: string | null = null
  let activeId: string | null = null

  for (const[provider, id] of Object.entries(ids)) {
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
      style={!bannerUrl ? "display:none" : ""}
    >
      <div
        class="banner-image-inner"
        id="banner-image-inner"
        style={innerStyle}
      ></div>
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
    return null;
  }

  async function init() {
    const root = document.getElementById("banner-image-root");
    if (!root) return;

    const provider = root.dataset.provider;
    const id = root.dataset.providerId;
    if (!provider || !id) return;

    const inner = document.getElementById("banner-image-inner");
    if (!inner) return;

    if (inner.style.backgroundImage) {
      root.style.display = "";
      root.classList.add("loaded");
      return;
    }

    const bannerUrl = await getBannerUrl(provider, id);

    if (!bannerUrl) {
      root.style.display = "none";
      return;
    }

    root.style.display = "";
    inner.style.backgroundImage = "url(" + bannerUrl + ")";
    root.classList.add("loaded");
  }

  document.addEventListener("nav", init);
  init();
})();
`

export default (() => BannerImage) satisfies QuartzComponentConstructor

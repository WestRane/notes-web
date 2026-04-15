import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import style from ".././styles/custom/bannerImage.scss"

import anilistData from "../../static/data/anilist.json"

interface RawFrontmatter {
  ids?: {
    anilist?: number
  }
}

const BannerImage: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const frontmatter = fileData.frontmatter as RawFrontmatter | undefined
  const anilistId = frontmatter?.ids?.anilist

  if (!anilistId) return null

  const entry = (anilistData as Record<string, { banner?: string }>)[String(anilistId)]
  const bannerUrl = entry?.banner

  const innerStyle = bannerUrl ? `background-image: url(${bannerUrl})` : ""

  return (
    <div
      class={`banner-image${bannerUrl ? " loaded" : ""}`}
      id="banner-image-root"
      data-anilist-id={String(anilistId)}
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
  let imageCache = null;

  async function loadCache() {
    if (imageCache) return imageCache;
    try {
      const res = await fetch("/static/data/anilist.json");
      imageCache = await res.json();
    } catch (e) {
      imageCache = {};
    }
    return imageCache;
  }

  async function init() {
    const root = document.getElementById("banner-image-root");
    if (!root) return;

    const anilistId = root.dataset.anilistId;
    if (!anilistId) return;

    const inner = document.getElementById("banner-image-inner");
    if (!inner) return;

    // Если уже установлено через SSR — пропускаем
    if (inner.style.backgroundImage) return;

    const cache = await loadCache();
    const entry = cache[anilistId];
    const bannerUrl = entry?.banner;

    if (!bannerUrl) {
      root.style.display = "none";
      return;
    }

    inner.style.backgroundImage = "url(" + bannerUrl + ")";
    root.classList.add("loaded");
  }

  document.addEventListener("nav", init);
  init();
})();
`

export default (() => BannerImage) satisfies QuartzComponentConstructor

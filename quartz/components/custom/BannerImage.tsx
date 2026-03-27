import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import style from ".././styles/custom/bannerImage.scss"

interface RawFrontmatter {
  ids?: {
    anilist?: number
  }
}

const BannerImage: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const frontmatter = fileData.frontmatter as RawFrontmatter | undefined
  const anilistId = frontmatter?.ids?.anilist
  if (!anilistId) return null

  return (
    <div
      class="banner-image"
      id="banner-image-root"
      data-anilist-id={String(anilistId)}
    >
      <div class="banner-image-inner" id="banner-image-inner"></div>
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

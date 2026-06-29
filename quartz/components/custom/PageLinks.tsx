import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import style from ".././styles/custom/pageLinks.scss"

const GITHUB_REPO = "WestRane/notes-content"

const ANILIST_CATEGORY_MAP: Record<string, string> = {
  anime: "anime",
  manga: "manga",
  ranobe: "manga",
}

interface RawFrontmatter {
  title?: string
  category?: string
  ids?: Record<string, string | number>
}

interface ProviderConfig {
  label: string
  icon: JSX.Element
  getUrl: (id: string | number, category?: string, title?: string) => string
  shouldRender?: (category?: string) => boolean
}

const providers: Record<string, ProviderConfig> = {
  anilist: {
    label: "AniList",
    icon: (
      <svg width="14" height="14" viewBox="0 0 172 172" fill="none">
        <path d="M111.322,111.157 L111.322,41.029 C111.322,37.010 109.105,34.792 105.086,34.792 L91.365,34.792 C87.346,34.792 85.128,37.010 85.128,41.029 C85.128,41.029 85.128,56.337 85.128,74.333 C85.128,75.271 94.165,79.626 94.401,80.547 C101.286,107.449 95.897,128.980 89.370,129.985 C100.042,130.513 101.216,135.644 93.267,132.138 C94.483,117.784 99.228,117.812 112.869,131.610 C112.986,131.729 115.666,137.351 115.833,137.351 C131.170,137.351 148.050,137.351 148.050,137.351 C152.069,137.351 154.286,135.134 154.286,131.115 L154.286,117.394 C154.286,113.375 152.069,111.157 148.050,111.157 L111.322,111.157 Z" fill="currentColor" fill-rule="evenodd"/>
        <path d="M54.365,34.792 L18.331,137.351 L46.327,137.351 L52.425,119.611 L82.915,119.611 L88.875,137.351 L116.732,137.351 L80.836,34.792 L54.365,34.792 ZM58.800,96.882 L67.531,68.470 L77.094,96.882 L58.800,96.882 Z" fill="currentColor" fill-rule="evenodd"/>
      </svg>
    ),
    getUrl: (id, category) => {
      const anilistCategory = ANILIST_CATEGORY_MAP[category ?? ""] ?? category ?? "anime"
      return `https://anilist.co/${anilistCategory}/${id}`
    }
  },
  steam: {
    label: "Steam",
    icon: (
      <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor">
        <path d="M18.102 12.129c0-0 0-0 0-0.001 0-1.564 1.268-2.831 2.831-2.831s2.831 1.268 2.831 2.831c0 1.564-1.267 2.831-2.831 2.831-0 0-0 0-0.001 0h0c-0 0-0 0-0.001 0-1.563 0-2.83-1.267-2.83-2.83 0-0 0-0 0-0.001v0zM24.691 12.135c0-2.081-1.687-3.768-3.768-3.768s-3.768 1.687-3.768 3.768c0 2.081 1.687 3.768 3.768 3.768v0c2.080-0.003 3.765-1.688 3.768-3.767v-0zM10.427 23.76l-1.841-0.762c0.524 1.078 1.611 1.808 2.868 1.808 1.317 0 2.448-0.801 2.93-1.943l0.008-0.021c0.155-0.362 0.246-0.784 0.246-1.226 0-1.757-1.424-3.181-3.181-3.181-0.405 0-0.792 0.076-1.148 0.213l0.022-0.007 1.903 0.787c0.852 0.364 1.439 1.196 1.439 2.164 0 1.296-1.051 2.347-2.347 2.347-0.324 0-0.632-0.066-0.913-0.184l0.015 0.006zM15.974 1.004c-7.857 0.001-14.301 6.046-14.938 13.738l-0.004 0.054 8.038 3.322c0.668-0.462 1.495-0.737 2.387-0.737 0.001 0 0.002 0 0.002 0h-0c0.079 0 0.156 0.005 0.235 0.008l3.575-5.176v-0.074c0.003-3.12 2.533-5.648 5.653-5.648 3.122 0 5.653 2.531 5.653 5.653s-2.531 5.653-5.653 5.653h-0.131l-5.094 3.638c0 0.065 0.005 0.131 0.005 0.199 0 0.001 0 0.002 0 0.003 0 2.342-1.899 4.241-4.241 4.241-2.047 0-3.756-1.451-4.153-3.38l-0.005-0.027-5.755-2.383c1.841 6.345 7.601 10.905 14.425 10.905 8.281 0 14.994-6.713 14.994-14.994s-6.713-14.994-14.994-14.994c-0 0-0.001 0-0.001 0h0z"></path>
      </svg>
    ),
    getUrl: (id) => `https://store.steampowered.com/app/${id}/`
  },
  igdb: {
    label: "Backloggd",
    icon: (
      <svg width="14" height="14" viewBox="0 10 98 98" fill="currentColor">
        <path fill-rule="evenodd" d="M32 15c47.27 0 47.27 0 57 8 4.97 6.24 5.86 12.18 5 20-1.49 4.6-3.56 8.71-8 11h-3v2c.72.06 1.44.12 2.19.19 4.72 1.36 6.99 4.56 9.62 8.56 2.34 6.39 1.73 12.78-.66 19.11-3.51 6.48-9.75 9.98-16.5 12.34-8.28 1.81-16.91 1.19-25.34 1.05-10.05-.12-10.05-.12-20.31-.25 0-27.06 0-54.12 0-82Zm20 15c14.37-.41 14.37-.41 20 3 2.39 2.39 2.32 3.09 2.38 6.38-.07 3.38-.16 4.34-2.25 7.12-4.06 2.86-7.44 2.62-12.25 2.56-2.6-.02-5.2-.04-7.88-.06 0-6.27 0-12.54 0-19Zm0 32c2.7-.06 5.4-.12 8.19-.19.84-.03 1.68-.06 2.55-.08 4.58-.05 7.55.28 11.26 3.27 2.45 3.67 2.83 6.73 2 11-2.53 3.22-4.11 4.7-8 6-2.74.07-5.45.09-8.19.06-2.58-.02-5.16-.04-7.81-.06 0-6.6 0-13.2 0-20Z"/>
      </svg>
    ),
    getUrl: (_id, _category, title) => `https://www.backloggd.com/search/games/${encodeURIComponent(title ?? "")}/`
  },
  tmdb: {
    label: "TMDb",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
        <line x1="7" y1="2" x2="7" y2="22"></line>
        <line x1="17" y1="2" x2="17" y2="22"></line>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="2" y1="7" x2="7" y2="7"></line>
        <line x1="2" y1="17" x2="7" y2="17"></line>
        <line x1="17" y1="17" x2="22" y2="17"></line>
        <line x1="17" y1="7" x2="22" y2="7"></line>
      </svg>
    ),
    getUrl: (id, category) => {
      const type = category === "movies" ? "movie" : "tv"
      return `https://www.themoviedb.org/${type}/${id}`
    }
  },
  serializd: {
    label: "Serializd",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
        <polyline points="17 2 12 7 7 2"></polyline>
      </svg>
    ),
    getUrl: (id) => `https://www.serializd.com/show/${id}`,
    shouldRender: (category) => category === "series"
  },
  letterboxd: {
    label: "Letterboxd",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="6" cy="12" r="6"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="18" cy="12" r="6"/>
      </svg>
    ),
    getUrl: (id) => `https://letterboxd.com/tmdb/${id}`,
    shouldRender: (category) => category === "movies"
  }  
}

const PageLinks: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const frontmatter = fileData.frontmatter as RawFrontmatter | undefined
  const ids = frontmatter?.ids
  const category = frontmatter?.category
  const title = frontmatter?.title

  const filePath = fileData.filePath
  const contentPrefix = "content/"
  const repoPath = filePath?.includes(contentPrefix)
    ? filePath.slice(filePath.indexOf(contentPrefix) + contentPrefix.length)
    : filePath ?? null

  const githubUrl = repoPath
    ? `https://github.com/${GITHUB_REPO}/blob/main/${repoPath}`
    : null

  const generatedLinks: { url: string; label: string; icon: JSX.Element }[] = []
  
  if (ids) {
    const effectiveIds = { ...ids }
    
    if (effectiveIds.tmdb && !effectiveIds.serializd && category === "series") {
      effectiveIds.serializd = effectiveIds.tmdb
    }
    
    if (effectiveIds.tmdb && !effectiveIds.letterboxd && category === "movies") {
      effectiveIds.letterboxd = effectiveIds.tmdb
    }

    for (const [providerKey, idValue] of Object.entries(effectiveIds)) {
      if (idValue && providers[providerKey]) {
        const provider = providers[providerKey]
        
        if (provider.shouldRender && !provider.shouldRender(category)) {
          continue
        }

        generatedLinks.push({
          url: provider.getUrl(idValue, category, title),
          label: provider.label,
          icon: provider.icon
        })
      }
    }
  }

  if (generatedLinks.length === 0 && !githubUrl) return null

  return (
    <div class="page-links">
      {generatedLinks.map((link) => (
        <a href={link.url} target="_blank" rel="noopener" class="page-link">
          {link.icon}
          {link.label}
        </a>
      ))}

      {githubUrl && (
        <a href={githubUrl} target="_blank" rel="noopener" class="page-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          Edit
        </a>
      )}
    </div>
  )
}

PageLinks.css = style
export default (() => PageLinks) satisfies QuartzComponentConstructor

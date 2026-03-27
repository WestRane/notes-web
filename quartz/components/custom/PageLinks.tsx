import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import style from ".././styles/custom/pageLinks.scss"

const GITHUB_REPO = "WestRane/notes-content"

const ANILIST_CATEGORY_MAP: Record<string, string> = {
  anime: "anime",
  manga: "manga",
  ranobe: "manga",
}

interface RawFrontmatter {
  category?: string
  ids?: {
    anilist?: number
    mal?: number
  }
}

const PageLinks: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const frontmatter = fileData.frontmatter as RawFrontmatter | undefined
  const anilistId = frontmatter?.ids?.anilist
  const category = frontmatter?.category
  const anilistCategory = ANILIST_CATEGORY_MAP[category ?? ""] ?? category ?? "anime"

  const filePath = fileData.filePath
  const contentPrefix = "content/"
  const repoPath = filePath?.includes(contentPrefix)
    ? filePath.slice(filePath.indexOf(contentPrefix) + contentPrefix.length)
    : filePath ?? null

  const anilistUrl = anilistId
    ? `https://anilist.co/${anilistCategory}/${anilistId}`
    : null

  const githubUrl = repoPath
    ? `https://github.com/${GITHUB_REPO}/blob/main/${repoPath}`
    : null

  if (!anilistUrl && !githubUrl) return null

  return (
    <div class="page-links">
      {anilistUrl && (
        <a href={anilistUrl} target="_blank" rel="noopener" class="page-link">
          <svg width="14" height="14" viewBox="0 0 172 172" fill="none">
            <path d="M111.322,111.157 L111.322,41.029 C111.322,37.010 109.105,34.792 105.086,34.792 L91.365,34.792 C87.346,34.792 85.128,37.010 85.128,41.029 C85.128,41.029 85.128,56.337 85.128,74.333 C85.128,75.271 94.165,79.626 94.401,80.547 C101.286,107.449 95.897,128.980 89.370,129.985 C100.042,130.513 101.216,135.644 93.267,132.138 C94.483,117.784 99.228,117.812 112.869,131.610 C112.986,131.729 115.666,137.351 115.833,137.351 C131.170,137.351 148.050,137.351 148.050,137.351 C152.069,137.351 154.286,135.134 154.286,131.115 L154.286,117.394 C154.286,113.375 152.069,111.157 148.050,111.157 L111.322,111.157 Z" fill="currentColor" fill-rule="evenodd"/>
            <path d="M54.365,34.792 L18.331,137.351 L46.327,137.351 L52.425,119.611 L82.915,119.611 L88.875,137.351 L116.732,137.351 L80.836,34.792 L54.365,34.792 ZM58.800,96.882 L67.531,68.470 L77.094,96.882 L58.800,96.882 Z" fill="currentColor" fill-rule="evenodd"/>
          </svg>
          AniList
        </a>
      )}
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

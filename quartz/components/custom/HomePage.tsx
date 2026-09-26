import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import { resolveRelative, FullSlug } from "../../util/path"
import { QuartzPluginData } from "../../plugins/vfile"
import style from ".././styles/custom/homePage.scss"
import { buildPageItem, RawFrontmatter } from "./NoteList"

interface ListSection {
  type: "list"
  title: string
  path: string
  limit?: number
  recursive?: boolean
  showCategory?: boolean
  allLabel?: string
  heading?: string
  description?: string | string[]
}

interface LinkSection {
  type: "link"
  title: string
  path: string
  description?: string
}

type Section = ListSection | LinkSection

interface Options {
  intro?: string
  sections: Section[]
}

export default ((opts: Options) => {
  const HomePage: QuartzComponent = ({ allFiles, fileData }: QuartzComponentProps) => {
    if (fileData.slug !== "index") return null

    const sectionsData = opts.sections.map((section) => {
      if (section.type === "link") {
        const page = allFiles.find((f) => f.slug === section.path || f.slug === section.path + "/index")
        if (!page && !section.description) return null
        return {
          type: "link" as const,
          title: section.title,
          href: resolveRelative(fileData.slug!, (section.path + "/index") as FullSlug),
          description: section.description ?? null,
        }
      }

      const limit = section.limit ?? 5
      const showCategory = section.showCategory ?? section.recursive ?? false

      const pages = allFiles
        .filter((f) => {
          if (!f.slug) return false
          if (f.slug.endsWith("/index")) return false
          if (section.recursive) return f.slug.startsWith(section.path + "/")
          return (
            f.slug.startsWith(section.path + "/") &&
            !f.slug.slice(section.path.length + 1).includes("/")
          )
        })
        .sort((a, b) => {
          const dateA = (a.frontmatter as RawFrontmatter)?.modified ?? (a.frontmatter as RawFrontmatter)?.created ?? ""
          const dateB = (b.frontmatter as RawFrontmatter)?.modified ?? (b.frontmatter as RawFrontmatter)?.created ?? ""
          return dateB.localeCompare(dateA)
        })
        .slice(0, limit) as QuartzPluginData[]

      if (pages.length === 0) return null

      const allLabel = section.allLabel ?? "All " + section.title.toLowerCase() + " →"
      const description = section.description
        ? (Array.isArray(section.description) ? section.description : [section.description])
        : null

      return {
        type: "list" as const,
        title: section.title,
        allHref: resolveRelative(fileData.slug!, (section.path + "/index") as FullSlug),
        allLabel,
        showCategory,
        heading: section.heading ?? null,
        description,
        pages: pages.map((p) => buildPageItem(p, fileData.slug!)),
      }
    }).flatMap((s) => (s ? [s] : []))

    const currentYear = new Date().getFullYear().toString()

    return (
      <div class="home-page" id="home-page-root">
        <div id="home-page-content">
          {opts.intro && <p class="home-intro">{opts.intro}</p>}
          {sectionsData.map((section) =>
            section.type === "link" ? (
              <div class="home-section">
                <div class="home-section-header">
                  <span class="home-section-title">{section.title}</span>
                </div>
                <a href={section.href} class="home-link-card">
                  <span class="home-link-title">{section.title}</span>
                  {section.description && (
                    <span class="home-link-desc">{section.description}</span>
                  )}
                </a>
              </div>
            ) : (
              <div class="home-section">
                {section.heading && <h2 class="home-section-heading">{section.heading}</h2>}
                {section.description?.map((line) => (
                  <p class="home-section-desc">{line}</p>
                ))}
                <div class="home-section-header">
                  <span class="home-section-title">{section.title}</span>
                  <a href={section.allHref} class="home-section-all">
                    {section.allLabel}
                  </a>
                </div>
                <div class="note-list-rows">
                  {section.pages.map((p) => (
                    <a
                      href={p.href}
                      class="note-list-item"
                      style="display:flex;flex-direction:row;align-items:center;"
                    >
                      {p.score !== undefined && p.status && (
                        <span class={`note-list-badge ${p.status}`}>{p.score}</span>
                      )}
                      <div
                        class="note-list-left"
                        style="display:flex;align-items:baseline;flex:1;min-width:0;"
                      >
                        <span class="note-list-title">{p.title}</span>
                      </div>
                      {section.showCategory && (
                        <span class="note-list-cat">{p.category ?? ""}</span>
                      )}
                      <span class="note-list-date">
                        {p.hasModified && (
                          <span class="note-list-date-pencil" title="Updated">
                            {"✎ "}
                          </span>
                        )}
                        {(p.date ?? "") +
                          (p.year && p.year !== "—" && p.year !== currentYear
                            ? " '" + p.year.slice(2)
                            : "")}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    )
  }

  HomePage.css = style

  return HomePage
}) satisfies QuartzComponentConstructor

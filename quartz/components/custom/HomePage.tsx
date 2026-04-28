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
    }).filter(Boolean)

    return (
      <div
        class="home-page"
        id="home-page-root"
        data-sections={JSON.stringify(sectionsData)}
        data-intro={opts.intro ?? ""}
      >
        <div id="home-page-content"></div>
      </div>
    )
  }

  HomePage.css = style

  HomePage.afterDOMLoaded = `
(function() {
  function renderItem(p, showCategory) {
    const a = document.createElement("a");
    a.href = p.href;
    a.className = "note-list-item";
    a.style.cssText = "display:flex;flex-direction:row;align-items:center;";

    if (p.score !== undefined && p.status) {
      const badge = document.createElement("span");
      badge.className = "note-list-badge " + p.status;
      badge.textContent = p.score;
      a.appendChild(badge);
    }

    const left = document.createElement("div");
    left.className = "note-list-left";
    left.style.cssText = "display:flex;align-items:baseline;flex:1;min-width:0;";
    const titleEl = document.createElement("span");
    titleEl.className = "note-list-title";
    titleEl.textContent = p.title;
    left.appendChild(titleEl);
    a.appendChild(left);

    if (showCategory) {
      const catEl = document.createElement("span");
      catEl.className = "note-list-cat";
      catEl.textContent = p.category || "";
      a.appendChild(catEl);
    }

    const dateEl = document.createElement("span");
    dateEl.className = "note-list-date";
    if (p.hasModified) {
      const pencil = document.createElement("span");
      pencil.className = "note-list-date-pencil";
      pencil.textContent = "✎ ";
      pencil.title = "Updated";
      dateEl.appendChild(pencil);
    }
    const currentYear = new Date().getFullYear().toString();
    const yearSuffix = (p.year && p.year !== "—" && p.year !== currentYear) ? " '" + p.year.slice(2) : "";
    dateEl.appendChild(document.createTextNode((p.date || "") + yearSuffix));
    a.appendChild(dateEl);

    return a;
  }

  function init() {
    const root = document.getElementById("home-page-root");
    if (!root) return;

    const sections = JSON.parse(root.dataset.sections || "[]");
    const intro = root.dataset.intro || "";
    const content = document.getElementById("home-page-content");
    if (!content) return;

    content.innerHTML = "";

    if (intro) {
      const p = document.createElement("p");
      p.className = "home-intro";
      p.textContent = intro;
      content.appendChild(p);
    }

    sections.forEach(function(section) {
      const div = document.createElement("div");
      div.className = "home-section";

      if (section.type === "link") {
        const header = document.createElement("div");
        header.className = "home-section-header";
        const titleEl = document.createElement("span");
        titleEl.className = "home-section-title";
        titleEl.textContent = section.title;
        header.appendChild(titleEl);
        div.appendChild(header);

        const card = document.createElement("a");
        card.href = section.href;
        card.className = "home-link-card";
        const cardTitle = document.createElement("span");
        cardTitle.className = "home-link-title";
        cardTitle.textContent = section.title;
        card.appendChild(cardTitle);
        if (section.description) {
          const desc = document.createElement("span");
          desc.className = "home-link-desc";
          desc.textContent = section.description;
          card.appendChild(desc);
        }
        div.appendChild(card);
      } else {
        if (section.heading) {
          const h = document.createElement("h2");
          h.className = "home-section-heading";
          h.textContent = section.heading;
          div.appendChild(h);
        }

        if (section.description && section.description.length > 0) {
          section.description.forEach(function(line) {
            const p = document.createElement("p");
            p.className = "home-section-desc";
            p.textContent = line;
            div.appendChild(p);
          });
        }

        const header = document.createElement("div");
        header.className = "home-section-header";
        const titleEl = document.createElement("span");
        titleEl.className = "home-section-title";
        titleEl.textContent = section.title;
        header.appendChild(titleEl);
        const allLink = document.createElement("a");
        allLink.href = section.allHref;
        allLink.className = "home-section-all";
        allLink.textContent = section.allLabel;
        header.appendChild(allLink);
        div.appendChild(header);

        const rows = document.createElement("div");
        rows.className = "note-list-rows";
        section.pages.forEach(function(p) {
          rows.appendChild(renderItem(p, section.showCategory));
        });
        div.appendChild(rows);
      }

      content.appendChild(div);
    });
  }

  document.addEventListener("nav", init);
  init();
})();
  `

  return HomePage
}) satisfies QuartzComponentConstructor

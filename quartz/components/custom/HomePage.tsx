import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import { resolveRelative, FullSlug } from "../../util/path"
import { QuartzPluginData } from "../../plugins/vfile"
import style from ".././styles/custom/homePage.scss"
import { buildPageItem, RawFrontmatter } from "./NoteList"
import anilistData from "../../static/data/anilist.json"

interface Options {
  intro?: string
  description?: string
  stats?: boolean
  recent?: {
    title?: string
    limit?: number
  }
  random?: boolean
  shelfIndex?: boolean
}

type FrontmatterWithIds = RawFrontmatter & { ids?: Record<string, string | number> }

const CATEGORY_ORDER = ["anime", "manga", "ranobe", "games", "series", "books", "movies"]

function isReviewPage(p: QuartzPluginData): boolean {
  return !!p.slug && p.slug.startsWith("reviews/") && !p.slug.endsWith("/index")
}

function pageDate(p: QuartzPluginData): string {
  const fm = p.frontmatter as RawFrontmatter | undefined
  return fm?.modified ?? fm?.created ?? ""
}

function sortByDateDesc(a: QuartzPluginData, b: QuartzPluginData): number {
  return pageDate(b).localeCompare(pageDate(a))
}

function resolveCover(p: QuartzPluginData): string | null {
  const fm = p.frontmatter as FrontmatterWithIds | undefined
  const ids = fm?.ids
  if (!ids) return null
  if (fm?.category === "books") {
    if (ids.openlibrary) return `https://covers.openlibrary.org/b/olid/${ids.openlibrary}-L.jpg`
    if (ids.isbn) return `https://covers.openlibrary.org/b/isbn/${ids.isbn}-L.jpg`
    return null
  }
  if (ids.anilist) {
    const entry = (anilistData as Record<string, { cover?: string }>)[String(ids.anilist)]
    if (entry?.cover) return entry.cover
  }
  return null
}

function resolveBanner(p: QuartzPluginData): string | null {
  const fm = p.frontmatter as FrontmatterWithIds | undefined
  const ids = fm?.ids
  if (!ids) return null
  if (ids.anilist) {
    const entry = (anilistData as Record<string, { banner?: string }>)[String(ids.anilist)]
    if (entry?.banner) return entry.banner
  }
  if (ids.steam) {
    return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${ids.steam}/library_hero.jpg`
  }
  if (ids.imdb) {
    return `https://images.metahub.space/background/medium/${ids.imdb}/img`
  }
  return null
}

export default ((opts: Options) => {
  const HomePage: QuartzComponent = ({ allFiles, fileData }: QuartzComponentProps) => {
    if (fileData.slug !== "index") return null

    const reviewPages = allFiles.filter(isReviewPage) as QuartzPluginData[]

    const statsData =
      opts.stats === true
        ? (() => {
            const tagsOf = (p: QuartzPluginData) => (p.frontmatter as RawFrontmatter)?.tags ?? []
            const typeCount = (t: string) => reviewPages.filter((p) => tagsOf(p).includes(t)).length
            const types = [
              { label: "reviews", count: typeCount("review") },
              { label: "notes", count: typeCount("note") },
              { label: "logs", count: typeCount("log") },
            ].filter((t) => t.count > 0)
            if (types.length === 0) return null
            return { types }
          })()
        : null

    const recentData = opts.recent
      ? (() => {
          const limit = opts.recent.limit ?? 6
          const latest = reviewPages
            .filter((p) =>
              ((p.frontmatter as RawFrontmatter)?.tags ?? []).some((t) =>
                ["review", "note"].includes(t),
              ),
            )
            .sort(sortByDateDesc)
            .slice(0, limit)
          if (latest.length === 0) return null
          return {
            title: opts.recent.title ?? "Latest",
            cards: latest.map((p) => {
              const item = buildPageItem(p, fileData.slug!)
              const yearSuffix = item.year && item.year !== "—" ? ` ${item.year}` : ""
              const dateLabel = `${item.date ?? ""}${yearSuffix}`.trim() || null
              return {
                item,
                cover: resolveBanner(p) ?? resolveCover(p),
                date: dateLabel,
                dateISO: pageDate(p) || null,
                tagline: (p.frontmatter as RawFrontmatter)?.tagline ?? null,
              }
            }),
          }
        })()
      : null

    const randomData = opts.random
      ? (() => {
          const pool = reviewPages
            .filter((p) =>
              ((p.frontmatter as RawFrontmatter)?.tags ?? []).some((t) =>
                ["review", "note"].includes(t),
              ),
            )
            .map((p) => {
              const item = {
                ...buildPageItem(p, fileData.slug!),
                cover: resolveBanner(p) ?? resolveCover(p),
              }
              const yearSuffix = item.year && item.year !== "—" ? ` ${item.year}` : ""
              const dateLabel = `${item.date ?? ""}${yearSuffix}`.trim() || null
              return {
                ...item,
                tagline: (p.frontmatter as RawFrontmatter)?.tagline ?? null,
                sub: dateLabel,
                dateISO: pageDate(p) || null,
              }
            })
          if (pool.length === 0) return null
          const now = new Date()
          const fallback = pool[(now.getFullYear() + now.getMonth()) % pool.length]
          return { pool, fallback }
        })()
      : null

    const shelfData = opts.shelfIndex
      ? CATEGORY_ORDER.map((category) => {
          const inCat = reviewPages.filter(
            (p) => (p.frontmatter as RawFrontmatter)?.category === category,
          )
          if (inCat.length === 0) return null
          const scored = inCat
            .map((p) => (p.frontmatter as RawFrontmatter)?.score)
            .filter((s): s is number => s !== undefined)
          const avg =
            scored.length > 0
              ? (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1)
              : null
          const recent = [...inCat].sort(sortByDateDesc)[0]
          const recentItem = buildPageItem(recent, fileData.slug!)
          const buckets = Array.from(
            { length: 10 },
            (_, i) =>
              inCat.filter((p) => (p.frontmatter as RawFrontmatter)?.score === i + 1).length,
          )
          return {
            category,
            count: inCat.length,
            avg,
            buckets,
            max: Math.max(...buckets, 1),
            updated:
              (recentItem.date ?? "") +
              (recentItem.year && recentItem.year !== "—" ? ` ${recentItem.year}` : ""),
            updatedISO: pageDate(recent) || null,
            href: resolveRelative(fileData.slug!, `reviews/${category}/index` as FullSlug),
          }
        })
          .flatMap((s) => (s ? [s] : []))
          .sort((a, b) => b.count - a.count)
      : null

    return (
      <div class="home-page">
        {opts.intro && <p class="home-intro">{opts.intro}</p>}
        {opts.description && (
          <p class="home-description">
            {opts.description
              .split("\n")
              .flatMap((line, i) => (i === 0 ? [line] : [<br key={i} />, line]))}
          </p>
        )}
        <div class="home-group">
          <h2 class="home-group-heading">Reviews</h2>
          {statsData && (
            <div class="home-stats">
              {statsData.types.map((t) => (
                <span class="home-stat-type">
                  <b>{t.count}</b> {t.label}
                </span>
              ))}
            </div>
          )}
          {shelfData && shelfData.length > 0 && (
            <div class="home-section">
              <div class="home-section-header">
                <span class="home-section-title">Browse shelves</span>
              </div>
              <div class="home-shelves">
                {shelfData.map((s) => (
                  <a href={s.href} class="home-shelf-card">
                    <span class="home-shelf-head">
                      <span class="home-shelf-name">{s.category}</span>
                      <span class="home-shelf-meta">
                        {s.count}
                        {s.avg ? ` · avg ${s.avg}` : ""}
                      </span>
                    </span>
                    {s.updated && (
                      <span class="home-shelf-updated">
                        Updated <span data-rel-date={s.updatedISO ?? undefined}>{s.updated}</span>
                      </span>
                    )}
                    <span class="home-dist-bars home-shelf-bars">
                      {s.buckets.map((b, i) => (
                        <span class="home-shelf-col" title={`${s.category} scored ${i + 1}: ${b}`}>
                          <span
                            class="home-dist-bar"
                            style={`height:${Math.max(3, Math.round((b / s.max) * 22))}px;opacity:${b === 0 ? 0.12 : 0.45 + 0.55 * (b / s.max)}`}
                            title={`${s.category} scored ${i + 1}: ${b}`}
                          />
                          <span class="home-shelf-tick">{i + 1}</span>
                        </span>
                      ))}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {recentData && (
            <div class="home-section">
              <div class="home-section-header">
                <span class="home-section-title">{recentData.title}</span>
              </div>
              <div class="home-recent">
                {recentData.cards.map(({ item, cover, date, dateISO, tagline }) => (
                  <a href={item.href} class="home-recent-card">
                    {cover && (
                      <span class="home-recent-art">
                        <img src={cover} alt="" loading="lazy" />
                      </span>
                    )}
                    <span class="home-recent-body">
                      {date && (
                        <span class="home-recent-date" data-rel-date={dateISO ?? undefined}>
                          {date}
                        </span>
                      )}
                      <span class="home-recent-title" title={item.title}>
                        {item.title}
                      </span>
                      {tagline && (
                        <span class="home-recent-tagline" title={tagline}>
                          {tagline}
                        </span>
                      )}
                      <span class="home-meta">
                        {item.score !== undefined && item.status && (
                          <span class={`note-list-badge ${item.status}`}>{item.score}</span>
                        )}
                        {item.category && <span class="home-badge">{item.category}</span>}
                        {item.locale && <span class="home-badge">{item.locale}</span>}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {randomData && (
            <div class="home-section" id="home-random" data-pool={JSON.stringify(randomData.pool)}>
              <div class="home-section-header">
                <span class="home-section-title">Random review</span>
              </div>
              <a href={randomData.fallback.href} class="home-random-card">
                {randomData.fallback.cover && (
                  <span class="home-random-art">
                    <img src={randomData.fallback.cover} alt="" loading="lazy" />
                  </span>
                )}
                <span class="home-random-body">
                  {randomData.fallback.sub && (
                    <span class="home-random-date">{randomData.fallback.sub}</span>
                  )}
                  <span class="home-random-title" title={randomData.fallback.title}>
                    {randomData.fallback.title}
                  </span>
                  {randomData.fallback.tagline && (
                    <span class="home-random-tagline" title={randomData.fallback.tagline}>
                      {randomData.fallback.tagline}
                    </span>
                  )}
                  <span class="home-meta">
                    {randomData.fallback.score !== undefined && randomData.fallback.status && (
                      <span class={`note-list-badge ${randomData.fallback.status}`}>
                        {randomData.fallback.score}
                      </span>
                    )}
                    {randomData.fallback.category && (
                      <span class="home-badge">{randomData.fallback.category}</span>
                    )}
                    {randomData.fallback.locale && (
                      <span class="home-badge">{randomData.fallback.locale}</span>
                    )}
                  </span>
                </span>
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  HomePage.css = style

  HomePage.afterDOMLoaded = `
(function() {
  var REL_DAY_LIMIT = 32;
  function rel(dateStr) {
    if (!dateStr) return null;
    var then = new Date(dateStr).getTime();
    if (isNaN(then)) return null;
    var days = Math.floor((Date.now() - then) / 86400000);
    if (days < 0 || days >= REL_DAY_LIMIT) return null;
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    return days + " days ago";
  }
  function tipIfClamped(el) {
    if (!el) return;
    if (el.scrollHeight > el.clientHeight + 1) el.setAttribute("title", el.textContent);
    else el.removeAttribute("title");
  }
  function render(root, pick) {
    var card = root.querySelector(".home-random-card");
    if (!card || !pick) return;
    card.setAttribute("href", pick.href);
    var art = card.querySelector(".home-random-art");
    var img = card.querySelector(".home-random-art img");
    if (pick.cover) {
      if (art) art.style.display = "";
      if (img) img.setAttribute("src", pick.cover);
    } else if (art) {
      art.style.display = "none";
    }
    var dateEl = card.querySelector(".home-random-date");
    var label = rel(pick.dateISO) || pick.sub;
    if (label) {
      if (!dateEl) {
        dateEl = document.createElement("span");
        dateEl.className = "home-random-date";
        card.querySelector(".home-random-body").prepend(dateEl);
      }
      dateEl.textContent = label;
      if (pick.sub && label !== pick.sub) dateEl.setAttribute("title", pick.sub);
      else dateEl.removeAttribute("title");
      dateEl.style.display = "";
    } else if (dateEl) {
      dateEl.style.display = "none";
    }
    var title = card.querySelector(".home-random-title");
    if (title) {
      title.textContent = pick.title;
      tipIfClamped(title);
    }
    var tagline = card.querySelector(".home-random-tagline");
    if (tagline) {
      if (pick.tagline) {
        tagline.textContent = pick.tagline;
        tagline.style.display = "";
      } else {
        tagline.style.display = "none";
      }
      tipIfClamped(tagline);
    }
    var meta = card.querySelector(".home-meta");
    if (meta) {
      meta.innerHTML = "";
      if (pick.score !== undefined && pick.status) {
        var badge = document.createElement("span");
        badge.className = "note-list-badge " + pick.status;
        badge.textContent = pick.score;
        meta.appendChild(badge);
      }
      if (pick.category) {
        var cat = document.createElement("span");
        cat.className = "home-badge";
        cat.textContent = pick.category;
        meta.appendChild(cat);
      }
      if (pick.locale) {
        var lang = document.createElement("span");
        lang.className = "home-badge";
        lang.textContent = pick.locale;
        meta.appendChild(lang);
      }
    }
  }

  function init() {
    var stamps = document.querySelectorAll("[data-rel-date]");
    for (var i = 0; i < stamps.length; i++) {
      var r = rel(stamps[i].getAttribute("data-rel-date"));
      if (r) {
        if (!stamps[i].hasAttribute("title")) stamps[i].setAttribute("title", stamps[i].textContent);
        stamps[i].textContent = r;
      }
    }
    var trunc = document.querySelectorAll(
      ".home-recent-title, .home-recent-tagline, .home-random-title, .home-random-tagline",
    );
    for (var j = 0; j < trunc.length; j++) tipIfClamped(trunc[j]);
    var root = document.getElementById("home-random");
    if (!root) return;
    var pool = [];
    try {
      pool = JSON.parse(root.dataset.pool || "[]");
    } catch (e) {
      return;
    }
    if (!pool.length) return;
    render(root, pool[Math.floor(Math.random() * pool.length)]);
  }

  document.addEventListener("nav", init);
  init();
})();
  `

  return HomePage
}) satisfies QuartzComponentConstructor

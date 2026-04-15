import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import { resolveRelative } from "../../util/path"
import { QuartzPluginData } from "../../plugins/vfile"
import style from ".././styles/custom/noteList.scss"
import { classNames } from "../../util/lang"

const DEFAULT_PAGE_SIZE = 20

export interface RawFrontmatter {
  title?: string
  score?: number
  category?: string
  modified?: string
  created?: string
  tags?: string[]
  locale?: string
  list?: {
    recursive?: boolean
    showCategory?: boolean
    enabled?: boolean
  }
}

type ScoreStatus = "good" | "okay" | "bad"

export function getStatus(score: number): ScoreStatus {
  if (score >= 7) return "good"
  if (score >= 5) return "okay"
  return "bad"
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" })
}

export function getYear(dateStr: string): string {
  return new Date(dateStr).getFullYear().toString()
}

export function buildPageItem(p: QuartzPluginData, fromSlug: string) {
  const pfm = p.frontmatter as RawFrontmatter
  const dateStr = pfm?.modified ?? pfm?.created
  const tags = pfm?.tags ?? []
  const FILTER_TAGS = ["review", "note", "log"]
  const filterTag = FILTER_TAGS.find((t) => tags.includes(t)) ?? null
  return {
    href: resolveRelative(fromSlug, p.slug!),
    title: pfm?.title ?? p.slug,
    score: pfm?.score,
    status: pfm?.score !== undefined ? getStatus(pfm.score) : null,
    date: dateStr ? formatShortDate(dateStr) : null,
    year: dateStr ? getYear(dateStr) : "—",
    category: pfm?.category ?? null,
    filterTag,
    locale: pfm?.locale ?? null,
    hasModified: !!(pfm?.modified && pfm?.created && pfm.modified !== pfm.created),
  }
}

const FILTER_TAGS = ["review", "note", "log"]

export default ((_userOpts?: never) => {
  const NoteList: QuartzComponent = ({ allFiles, fileData, displayClass }: QuartzComponentProps) => {
    const originalSlug = fileData.slug!

    if (!originalSlug.endsWith("/index") && originalSlug !== "index") return null

    const fm = fileData.frontmatter as RawFrontmatter | undefined
    if (fm?.list?.enabled === false) return null

    const currentSlug = originalSlug.replace(/\/index$/, "")
    const recursive = fm?.list?.recursive ?? true

    const hasSubfolders = allFiles.some((f) => {
      if (!f.slug) return false
      if (!f.slug.endsWith("/index")) return false
      if (f.slug === originalSlug) return false
      return f.slug.startsWith(currentSlug + "/")
    })
    const showCategory = fm?.list?.showCategory ?? hasSubfolders

    const pages = allFiles
      .filter((f) => {
        if (!f.slug) return false
        if (f.slug === originalSlug) return false
        if (f.slug.endsWith("/index")) return false
        if (recursive) return f.slug.startsWith(currentSlug + "/")
        return (
          f.slug.startsWith(currentSlug + "/") &&
          !f.slug.slice(currentSlug.length + 1).includes("/")
        )
      })
      .sort((a, b) => {
        const dateA = (a.frontmatter as RawFrontmatter)?.modified ?? (a.frontmatter as RawFrontmatter)?.created ?? ""
        const dateB = (b.frontmatter as RawFrontmatter)?.modified ?? (b.frontmatter as RawFrontmatter)?.created ?? ""
        return dateB.localeCompare(dateA)
      }) as QuartzPluginData[]

    if (pages.length === 0) return null

    const allData = pages.map((p) => buildPageItem(p, originalSlug))

    const availableTags = FILTER_TAGS.filter((t) => allData.some((p) => p.filterTag === t))
    const availableLangs = [...new Set(allData.map((p) => p.locale).filter(Boolean))] as string[]

    return (
      <div
        class={classNames(displayClass, "note-list")}
        id="note-list-root"
        data-pages={JSON.stringify(allData)}
        data-show-category={showCategory ? "1" : "0"}
        data-available-tags={JSON.stringify(availableTags)}
        data-available-langs={JSON.stringify(availableLangs)}
        data-page-size={String(DEFAULT_PAGE_SIZE)}
      >
        <div class="note-list-header">
          <span class="note-list-count" id="note-list-count"></span>
          <div class="note-list-header-right">
            <div class="note-list-filters" id="note-list-filters"></div>
            <label class="note-list-log-toggle" id="note-list-log-toggle"
              title="Short informal notes, hidden by default">
              <input type="checkbox" id="note-list-log-switch" />
              <span class="note-list-log-toggle-track">
                <span class="note-list-log-toggle-thumb"></span>
              </span>
              <span class="note-list-log-toggle-label">logs</span>
            </label>
          </div>
        </div>
        <div class="note-list-groups" id="note-list-groups"></div>
        <div class="note-list-pagination" id="note-list-pagination"></div>
      </div>
    )
  }

  NoteList.css = style

  NoteList.afterDOMLoaded = `
(function() {
  function init() {
    const root = document.getElementById("note-list-root");
    if (!root) return;

    const DATA = JSON.parse(root.dataset.pages || "[]");
    const SHOW_CATEGORY = root.dataset.showCategory === "1";
    const PAGE_SIZE = parseInt(root.dataset.pageSize || "20");
    const availableTags = JSON.parse(root.dataset.availableTags || "[]");
    const availableLangs = JSON.parse(root.dataset.availableLangs || "[]");

    const hasLogs = DATA.some(function(p) { return p.filterTag === "log"; });
    const publicTags = availableTags.filter(function(t) { return t !== "log"; });
    const multiTag = publicTags.length > 1;
    const multiLang = availableLangs.length > 1;

    const params = new URLSearchParams(location.search);
    let activeTag = params.get('tag') || 'all';
    let activeLang = params.get('lang') || 'all';
    let showLogs = sessionStorage.getItem('noteListShowLogs') === '1';
    let currentPage = Math.max(0, parseInt(params.get('page') || '1') - 1);

    const toggleWrapper = document.getElementById("note-list-log-toggle");
    if (toggleWrapper && hasLogs) {
      toggleWrapper.classList.add("is-visible");
    }

    const filtersEl = document.getElementById("note-list-filters");
    if (filtersEl) {
      filtersEl.innerHTML = "";

      if (publicTags.length > 0) {
        const group = document.createElement("div");
        group.className = "note-list-filter-group";
        group.id = "note-list-filter-tag";
        if (multiTag) {
          const btn = document.createElement("button");
          btn.className = "note-list-filter-btn";
          btn.dataset.value = "all";
          btn.textContent = "all";
          group.appendChild(btn);
        }
        publicTags.forEach(function(t) {
          const btn = document.createElement("button");
          btn.className = "note-list-filter-btn";
          btn.dataset.value = t;
          btn.textContent = t;
          group.appendChild(btn);
        });
        filtersEl.appendChild(group);
      }

      if (availableLangs.length > 0) {
        const group = document.createElement("div");
        group.className = "note-list-filter-group";
        group.id = "note-list-filter-lang";
        if (multiLang) {
          const btn = document.createElement("button");
          btn.className = "note-list-filter-btn";
          btn.dataset.value = "all";
          btn.textContent = "all";
          group.appendChild(btn);
        }
        availableLangs.forEach(function(l) {
          const btn = document.createElement("button");
          btn.className = "note-list-filter-btn";
          btn.dataset.value = l;
          btn.textContent = l;
          group.appendChild(btn);
        });
        filtersEl.appendChild(group);
      }

      ['note-list-filter-tag', 'note-list-filter-lang'].forEach(function(groupId) {
        const group = document.getElementById(groupId);
        if (!group) return;
        const activeVal = groupId === 'note-list-filter-tag' ? activeTag : activeLang;
        group.querySelectorAll('.note-list-filter-btn').forEach(function(b) {
          b.classList.toggle('active', b.dataset.value === activeVal);
        });
      });
    }

    function syncLogFilterBtn() {
      const group = document.getElementById("note-list-filter-tag");
      if (!group) return;
      let logBtn = group.querySelector('[data-value="log"]');
      if (showLogs) {
        if (!logBtn) {
          logBtn = document.createElement("button");
          logBtn.className = "note-list-filter-btn";
          logBtn.dataset.value = "log";
          logBtn.textContent = "log";
          group.appendChild(logBtn);
        }
        group.style.display = "";
      } else {
        if (logBtn) logBtn.remove();
        if (activeTag === "log") {
          activeTag = "all";
          group.querySelectorAll(".note-list-filter-btn").forEach(function(b) {
            b.classList.toggle("active", b.dataset.value === "all");
          });
        }
      }
    }

    function filtered() {
      return DATA.filter(function(p) {
        const isLog = p.filterTag === "log";
        if (isLog && !showLogs) return false;
        const tagOk = activeTag === "all" || p.filterTag === activeTag;
        const langOk = activeLang === "all" || p.locale === activeLang;
        return tagOk && langOk;
      });
    }

    function renderItem(p, showCategory, showType) {
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

      if (showType) {
        const typeEl = document.createElement("span");
        typeEl.className = "note-list-type";
        typeEl.textContent = p.filterTag || "";
        a.appendChild(typeEl);
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
      dateEl.appendChild(document.createTextNode(p.date || ""));
      a.appendChild(dateEl);

      return a;
    }

    function render() {
      const container = document.getElementById("note-list-groups");
      const countEl = document.getElementById("note-list-count");
      const paginationEl = document.getElementById("note-list-pagination");
      if (!container || !countEl || !paginationEl) return;

      container.innerHTML = "";
      paginationEl.innerHTML = "";

      const items = filtered();
      const totalPages = Math.ceil(items.length / PAGE_SIZE);

      if (currentPage >= totalPages) {
        currentPage = Math.max(0, totalPages - 1);
      }

      const url = new URL(location.href);
      if (currentPage === 0) {
        url.searchParams.delete('page');
      } else {
        url.searchParams.set('page', currentPage + 1);
      }
      if (activeTag === 'all') {
        url.searchParams.delete('tag');
      } else {
        url.searchParams.set('tag', activeTag);
      }
      if (activeLang === 'all') {
        url.searchParams.delete('lang');
      } else {
        url.searchParams.set('lang', activeLang);
      }
      history.replaceState(null, '', url);

      const start = currentPage * PAGE_SIZE;
      const visible = items.slice(start, start + PAGE_SIZE);

      countEl.textContent = items.length + " " + (items.length === 1 ? "note" : "notes");

      const prevLastYear = currentPage > 0
        ? (items[start - 1] ? items[start - 1].year : null)
        : null;

      const groups = [];
      visible.forEach(function(p) {
        const last = groups[groups.length - 1];
        if (last && last.year === p.year) {
          last.items.push(p);
        } else {
          groups.push({ year: p.year, items: [p] });
        }
      });

      groups.forEach(function(g, i) {
        const groupEl = document.createElement("div");
        groupEl.className = "note-list-group";
        groupEl.setAttribute("data-year", g.year);

        const isFirstGroup = i === 0;
        const continuedFromPrev = isFirstGroup && prevLastYear === g.year;

        if (!continuedFromPrev) {
          const yearEl = document.createElement("div");
          yearEl.className = "note-list-year";
          yearEl.textContent = g.year;
          groupEl.appendChild(yearEl);
        }

        const rowsEl = document.createElement("div");
        rowsEl.className = "note-list-rows";
        const hasMultipleTypes = new Set(items.map(p => p.filterTag).filter(Boolean)).size > 1;
        g.items.forEach(function(p) {
          rowsEl.appendChild(renderItem(p, SHOW_CATEGORY, hasMultipleTypes));
        });

        groupEl.appendChild(rowsEl);
        container.appendChild(groupEl);
      });

      if (totalPages > 1) {
        for (var i = 0; i < totalPages; i++) {
          (function(pageIndex) {
            const btn = document.createElement("button");
            btn.className = "note-list-page-btn" + (pageIndex === currentPage ? " active" : "");
            btn.textContent = pageIndex + 1;
            btn.addEventListener("click", function() {
              currentPage = pageIndex;
              render();
              root.scrollIntoView({ behavior: "smooth", block: "start" });
            });
            paginationEl.appendChild(btn);
          })(i);
        }
      }
    }

    function setupFilter(groupId, setActive, multi) {
      if (!multi) return;
      const group = document.getElementById(groupId);
      if (!group) return;
      group.addEventListener("click", function(e) {
        const btn = e.target.closest(".note-list-filter-btn");
        if (!btn) return;
        group.querySelectorAll(".note-list-filter-btn").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        setActive(btn.dataset.value);
        currentPage = 0;
        render();
      });
    }

    const logLabel = document.getElementById("note-list-log-toggle");
    const logSwitch = document.getElementById("note-list-log-switch");

    if (logSwitch && showLogs) {
      logSwitch.checked = true;
      if (toggleWrapper) toggleWrapper.classList.add("is-active");
      syncLogFilterBtn();
    }

    if (logSwitch) {
      logSwitch.addEventListener("change", function() {
        showLogs = logSwitch.checked;
        sessionStorage.setItem('noteListShowLogs', showLogs ? '1' : '0');
        logLabel.classList.toggle("is-active", showLogs);
        currentPage = 0;
        syncLogFilterBtn();
        render();
        document.dispatchEvent(new CustomEvent("updateExplorerCounters"));
      });
    }

    const tagGroup = document.getElementById("note-list-filter-tag");
    if (tagGroup) {
      tagGroup.addEventListener("click", function(e) {
        const btn = e.target.closest(".note-list-filter-btn");
        if (!btn) return;
        tagGroup.querySelectorAll(".note-list-filter-btn").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        activeTag = btn.dataset.value;
        currentPage = 0;
        render();
      });
    }

    setupFilter("note-list-filter-lang", function(v) { activeLang = v; }, multiLang);

    render();
  }

  document.addEventListener("nav", init);
  init();
})();
  `

  return NoteList
}) satisfies QuartzComponentConstructor

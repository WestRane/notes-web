import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import { resolveRelative } from "../../util/path"
import { QuartzPluginData } from "../../plugins/vfile"
import style from ".././styles/custom/noteList.scss"
import { classNames } from "../../util/lang"
import { reviewPosterUrl, reviewBannerUrl } from "./reviewAssets"

const DEFAULT_PAGE_SIZE = 20

export interface RawFrontmatter {
  title?: string
  tagline?: string
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
  const ids = (pfm as { ids?: Record<string, string | number> })?.ids
  return {
    href: resolveRelative(fromSlug, p.slug!),
    title: pfm?.title ?? p.slug,
    score: pfm?.score ?? undefined,
    status: pfm?.score != null ? getStatus(pfm.score) : null,
    date: dateStr ? formatShortDate(dateStr) : null,
    dateFull: dateStr ? formatDate(dateStr) : null,
    ts: dateStr ? new Date(dateStr).getTime() : 0,
    cover: reviewPosterUrl(pfm?.category, ids) ?? reviewBannerUrl(pfm?.category, ids) ?? null,
    tagline: pfm?.tagline ?? null,
    year: dateStr ? getYear(dateStr) : "—",
    category: pfm?.category ?? null,
    filterTag,
    locale: pfm?.locale ?? null,
    hasModified: !!(pfm?.modified && pfm?.created && pfm.modified !== pfm.created),
  }
}

const FILTER_TAGS = ["review", "note", "log"]

// Canonical review categories. Folder pages like /reviews/games hide their own
// category pill; HomePage reuses this for shelf order.
export const REVIEW_CATEGORIES = ["anime", "manga", "ranobe", "games", "series", "books", "movies"]

export default ((_userOpts?: never) => {
  const NoteList: QuartzComponent = ({
    allFiles,
    fileData,
    displayClass,
  }: QuartzComponentProps) => {
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

    // Strip the current folder's own category pill (e.g. no "games" pills on
    // /reviews/games). Type/locale pills always render.
    const slugParts = currentSlug.split("/")
    const hideCategory =
      slugParts[0] === "reviews" && REVIEW_CATEGORIES.includes(slugParts[1] ?? "")
        ? slugParts[1]
        : null

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
        const dateA =
          (a.frontmatter as RawFrontmatter)?.modified ??
          (a.frontmatter as RawFrontmatter)?.created ??
          ""
        const dateB =
          (b.frontmatter as RawFrontmatter)?.modified ??
          (b.frontmatter as RawFrontmatter)?.created ??
          ""
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
        data-hide-category={hideCategory ?? undefined}
        data-available-tags={JSON.stringify(availableTags)}
        data-available-langs={JSON.stringify(availableLangs)}
        data-page-size={String(DEFAULT_PAGE_SIZE)}
      >
        <div class="note-list-header">
          <span class="note-list-count" id="note-list-count"></span>
          <div class="note-list-header-right">
            <div class="note-list-filters" id="note-list-filters"></div>
            <div class="note-list-controls" id="note-list-controls">
              <button
                class="note-list-filter-btn note-list-controls-trigger"
                id="note-list-controls-trigger"
                aria-haspopup="true"
                aria-expanded="false"
              >
                Filters
              </button>
              <div class="note-list-controls-menu" id="note-list-controls-menu"></div>
            </div>
            <label
              class="note-list-log-toggle"
              id="note-list-log-toggle"
              title="Short informal notes, hidden by default"
            >
              <input type="checkbox" id="note-list-log-switch" />
              <span class="note-list-log-toggle-track">
                <span class="note-list-log-toggle-thumb"></span>
              </span>
              <span class="note-list-log-toggle-label">logs</span>
            </label>
          </div>
        </div>
        <div class="note-list-grid" id="note-list-grid"></div>
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
    // init() fires twice on full load (direct call + Quartz's initial "nav"
    // event) on the SAME nodes. A second run would create a second closure
    // sharing the DOM: sort writes would land in one closure's state while
    // filter/pagination renders read the other's, silently dropping state.
    // SPA navigation swaps the DOM, so a per-node flag is the right guard.
    if (root.dataset.noteListInit === "1") return;
    root.dataset.noteListInit = "1";

    const DATA = JSON.parse(root.dataset.pages || "[]");
    const SHOW_CATEGORY = root.dataset.showCategory === "1";
    const HIDE_CATEGORY = root.dataset.hideCategory || null;
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
      if (showLogs && hasLogs) {
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

    // Sort registry — chronological ("newest") default. Scores may be missing;
    // unscored items sink to the bottom in both rated orders.
    const SORTS = {
      newest: function(a, b) { return b.ts - a.ts; },
      oldest: function(a, b) { return a.ts - b.ts; },
      top: function(a, b) { return (b.score ?? -Infinity) - (a.score ?? -Infinity); },
      low: function(a, b) { return (a.score ?? Infinity) - (b.score ?? Infinity); },
      az: function(a, b) { return String(a.title).localeCompare(String(b.title)); },
    }
    const SORT_LABELS = {
      newest: "Newest first",
      oldest: "Oldest first",
      top: "Top rated",
      low: "Lowest rated",
      az: "Title A–Z",
    }
    const requestedSort = params.get('sort') || 'newest';
    let activeSort = SORTS[requestedSort] ? requestedSort : "newest"

    function sortItems(list) {
      return list.slice().sort(SORTS[activeSort])
    }

    const headerRight = document.querySelector(".note-list-header-right");
    let sortWrap = document.getElementById("note-list-sort");
    if (headerRight && !sortWrap) {
      sortWrap = document.createElement("div");
      sortWrap.className = "note-list-sort-wrap";
      sortWrap.id = "note-list-sort";
      const trigger = document.createElement("button");
      trigger.className = "note-list-filter-btn note-list-sort-trigger";
      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute("aria-expanded", "false");
      sortWrap.appendChild(trigger);
      const menu = document.createElement("div");
      menu.className = "note-list-sort-menu";
      Object.keys(SORTS).forEach(function(key) {
        const btn = document.createElement("button");
        btn.className = "note-list-filter-btn";
        btn.dataset.value = key;
        btn.textContent = SORT_LABELS[key];
        menu.appendChild(btn);
      });
      sortWrap.appendChild(menu);
      function setMenu(open) {
        menu.classList.toggle("open", open);
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
      }
      function syncSortUI() {
        trigger.textContent = SORT_LABELS[activeSort];
        menu.querySelectorAll(".note-list-filter-btn").forEach(function(b) {
          b.classList.toggle("active", b.dataset.value === activeSort);
        });
      }
      trigger.addEventListener("click", function(e) {
        e.stopPropagation();
        setMenu(!menu.classList.contains("open"));
      });
      menu.addEventListener("click", function(e) {
        const btn = e.target.closest(".note-list-filter-btn");
        if (!btn || !SORTS[btn.dataset.value]) return;
        activeSort = btn.dataset.value;
        currentPage = 0;
        syncSortUI();
        setMenu(false);
        render();
      });
      sortWrap.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
          setMenu(false);
          trigger.focus();
        }
      });
      // One document-level closer for all inits: queries live DOM each click,
      // so it stays correct across SPA navigations (no stale closures).
      if (!document.__noteListSortCloser) {
        document.__noteListSortCloser = true;
        document.addEventListener("click", function(e) {
          document.querySelectorAll(".note-list-sort-menu.open, .note-list-controls-menu.open").forEach(function(openMenu) {
            if (!openMenu.parentElement.contains(e.target)) {
              openMenu.classList.remove("open");
              const t = openMenu.parentElement.querySelector('[aria-expanded="true"]');
              if (t) t.setAttribute("aria-expanded", "false");
            }
          });
        });
      }
      headerRight.prepend(sortWrap);
      sortWrap.__syncSortUI = syncSortUI;
    }
    if (sortWrap && sortWrap.__syncSortUI) sortWrap.__syncSortUI();

    // Mobile collapse: one document-level relocator (nav-proof, queries live
    // DOM) moves the filter groups into the Filters panel on narrow screens
    // and back to the header on wide ones. Sort keeps its own trigger in both
    // layouts. Same nodes move, so all listeners and state survive the trip;
    // logs toggle always stays in the header.
    if (!document.__noteListControlsApply) {
      const mq = window.matchMedia("(max-width: 600px)");
      document.__noteListControlsApply = function() {
        document.querySelectorAll(".note-list-header-right").forEach(function(hr) {
          const menu = hr.querySelector("#note-list-controls-menu");
          const controls = hr.querySelector("#note-list-controls");
          const filters = hr.querySelector("#note-list-filters");
          if (!menu || !controls || !filters) return;
          if (mq.matches) {
            menu.appendChild(filters);
          } else {
            hr.insertBefore(filters, controls);
          }
        });
      };
      mq.addEventListener("change", document.__noteListControlsApply);
    }
    document.__noteListControlsApply();

    const controlsWrap = document.getElementById("note-list-controls");
    const controlsTrigger = document.getElementById("note-list-controls-trigger");
    const controlsMenu = document.getElementById("note-list-controls-menu");
    if (controlsWrap && controlsTrigger && controlsMenu) {
      controlsTrigger.addEventListener("click", function(e) {
        e.stopPropagation();
        const open = !controlsMenu.classList.contains("open");
        controlsMenu.classList.toggle("open", open);
        controlsTrigger.setAttribute("aria-expanded", open ? "true" : "false");
      });
      controlsWrap.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
          controlsMenu.classList.remove("open");
          controlsTrigger.setAttribute("aria-expanded", "false");
          controlsTrigger.focus();
        }
      });
    }

    function renderCard(p, showLang) {
      const a = document.createElement("a");
      a.href = p.href;
      a.className = "note-list-card";
      a.title = p.title;

      const art = document.createElement("div");
      art.className = "note-list-card-art";
      if (p.cover) {
        const img = document.createElement("img");
        img.src = p.cover;
        img.alt = "";
        img.loading = "lazy";
        art.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.className = "note-list-card-noart";
        ph.textContent = (p.title || "?").charAt(0);
        art.appendChild(ph);
      }

      const chips = document.createElement("span");
      chips.className = "rv-chips";
      if (p.category && p.category !== HIDE_CATEGORY) {
        const catEl = document.createElement("span");
        catEl.className = "rv-chip";
        catEl.textContent = p.category;
        chips.appendChild(catEl);
      }
      if (p.filterTag) {
        const typeEl = document.createElement("span");
        typeEl.className = "rv-chip";
        typeEl.textContent = p.filterTag;
        chips.appendChild(typeEl);
      }
      if (showLang && p.locale) {
        const langEl = document.createElement("span");
        langEl.className = "rv-chip";
        langEl.textContent = p.locale;
        chips.appendChild(langEl);
      }
      if (chips.childNodes.length > 0) art.appendChild(chips);

      if (p.status) {
        const score = document.createElement("span");
        score.className = "rv-score " + p.status;
        const num = document.createElement("b");
        num.textContent = p.score;
        score.appendChild(num);
        const max = document.createElement("small");
        max.textContent = "/10";
        score.appendChild(max);
        art.appendChild(score);
      }
      a.appendChild(art);

      const titleEl = document.createElement("div");
      titleEl.className = "note-list-card-title";
      titleEl.textContent = p.title;
      a.appendChild(titleEl);

      if (p.tagline) {
        const tagEl = document.createElement("div");
        tagEl.className = "note-list-card-tagline";
        tagEl.textContent = p.tagline;
        a.appendChild(tagEl);
      }

      const meta = document.createElement("div");
      meta.className = "note-list-card-meta";

      const dateEl = document.createElement("span");
      dateEl.className = "note-list-card-date";
      if (p.hasModified) {
        const pencil = document.createElement("span");
        pencil.className = "note-list-date-pencil";
        pencil.textContent = "✎ ";
        pencil.title = "Updated";
        dateEl.appendChild(pencil);
      }
      dateEl.appendChild(document.createTextNode(p.dateFull || p.date || ""));
      meta.appendChild(dateEl);

      a.appendChild(meta);
      return a;
    }

    function render() {
      const container = document.getElementById("note-list-grid");
      const countEl = document.getElementById("note-list-count");
      const paginationEl = document.getElementById("note-list-pagination");
      if (!container || !countEl || !paginationEl) return;

      container.innerHTML = "";
      paginationEl.innerHTML = "";

      const items = sortItems(filtered());
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
      if (activeSort === 'newest') {
        url.searchParams.delete('sort');
      } else {
        url.searchParams.set('sort', activeSort);
      }
      history.replaceState(null, '', url);

      const start = currentPage * PAGE_SIZE;
      const visible = items.slice(start, start + PAGE_SIZE);

      countEl.textContent = items.length + " " + (items.length === 1 ? "note" : "notes");

      const showLang = availableLangs.length > 1;
      visible.forEach(function(p) {
        container.appendChild(renderCard(p, showLang));
      });

      if (totalPages > 1) {
        // Windowed pages: first + last always visible, ±1 around current,
        // ellipses collapse the rest so 20+ pages never overflow the row.
        var pages = [];
        for (var i = 0; i < totalPages; i++) {
          if (i === 0 || i === totalPages - 1 || Math.abs(i - currentPage) <= 1) {
            pages.push(i);
          } else if (pages[pages.length - 1] !== -1) {
            pages.push(-1);
          }
        }
        function goTo(pageIndex) {
          currentPage = pageIndex;
          render();
        }
        function navBtn(label, target, disabled, navClass) {
          const btn = document.createElement("button");
          btn.className = "note-list-page-btn" + (navClass ? " " + navClass : "");
          btn.textContent = label;
          btn.disabled = disabled;
          if (!disabled) {
            btn.addEventListener("click", function() {
              goTo(target);
            });
          }
          paginationEl.appendChild(btn);
        }
        navBtn("‹", currentPage - 1, currentPage === 0, "nav");
        pages.forEach(function(pageIndex) {
          if (pageIndex === -1) {
            const gap = document.createElement("span");
            gap.className = "note-list-page-ellipsis";
            gap.textContent = "…";
            gap.title = "Go to page";
            gap.addEventListener("click", function() {
              const input = document.createElement("input");
              input.className = "note-list-page-jump";
              input.type = "text";
              input.inputMode = "numeric";
              input.placeholder = "…";
              input.setAttribute("aria-label", "Go to page");
              gap.replaceWith(input);
              input.focus();
              var settled = false;
              function done(commit) {
                if (settled) return;
                settled = true;
                if (commit) {
                  const n = parseInt(input.value, 10);
                  if (!isNaN(n)) {
                    goTo(Math.min(totalPages - 1, Math.max(0, n - 1)));
                    return;
                  }
                }
                render();
              }
              input.addEventListener("keydown", function(e) {
                if (e.key === "Enter") done(true);
                else if (e.key === "Escape") done(false);
              });
              input.addEventListener("blur", function() {
                done(false);
              });
            });
            paginationEl.appendChild(gap);
            return;
          }
          const btn = document.createElement("button");
          btn.className = "note-list-page-btn" + (pageIndex === currentPage ? " active" : "");
          btn.textContent = pageIndex + 1;
          (function (target) {
            btn.addEventListener("click", function() {
              goTo(target);
            });
          })(pageIndex);
          paginationEl.appendChild(btn);
        });
        navBtn("›", currentPage + 1, currentPage === totalPages - 1, "nav");
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

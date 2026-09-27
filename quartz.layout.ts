import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.ScoreBlock(),
    Component.ConditionalRender({
      component: Component.Comments({
        provider: "giscus",
        options: {
          repo: "WestRane/notes-web",
          repoId: "R_kgDORrnoqQ",
          category: "Announcements",
          categoryId: "DIC_kwDORrnoqc4C75j0",
          lang: "en",
          mapping: "pathname",
        },
      }),
      condition: (page) => {
        const isMainIndex = page.fileData.slug === "index"
        const isFolderIndex = page.fileData.slug?.endsWith("/index")
        return !isMainIndex && !isFolderIndex
      },
    }),
  ],
  footer: Component.Footer({
    links: {
      Discord: "https://discord.gg/2cjUKYkPjE",
      AniList: "https://anilist.co/user/EastRane/",
      Serializd: "https://www.serializd.com/user/EastRane",
      Letterboxd: "https://letterboxd.com/EastRane/",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.BannerImage(),
    Component.ArticleTitle(),
    Component.ConditionalRender({
      component: Component.ContentMeta(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.TagList(),
    Component.ConditionalRender({
      component: Component.ReviewLinks(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.SpoilerWarning(),
    Component.ConditionalRender({
      component: Component.HomePage({
        intro: "Notes on things I consume and occasionally break",
        description:
          "Hello, it's me. As for who I am... well, if you know, you know. I write reviews and notes on stuff like anime, games, shows, books and other media — mostly for myself, but feel free to browse around. \nAlways down to chat, so feel free to reach out if you want to talk about reviews, shows or just hang out.",
        stats: true,
        recent: { title: "Recent updates", limit: 20 },
        random: true,
        shelfIndex: true,
      }),
      condition: (page) => page.fileData.slug === "index",
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({
      filterFn: (node) => node.isFolder,
      folderDefaultState: "open",
      useSavedState: false,
    }),
  ],
  right: [Component.DesktopOnly(Component.TableOfContents()), Component.Backlinks()],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.NoteList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      filterFn: (node) => node.isFolder,
      folderDefaultState: "open",
      useSavedState: false,
    }),
  ],
  right: [],
}

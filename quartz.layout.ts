import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.ScoreBlock(),
    Component.Comments({
      provider: 'giscus',
      options: {
        repo: 'WestRane/notes-web',
        repoId: 'R_kgDORrnoqQ',
        category: 'Announcements',
        categoryId: 'DIC_kwDORrnoqc4C75j0',
        lang: 'en',
        mapping: 'pathname'
      }
    }),
  ],
  footer: Component.Footer({
    links: {
      AniList: "https://anilist.co/user/EastRane/"
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
      sections: [
        {
          type: "list",
          title: "Latest reviews",
          path: "reviews",
          recursive: true,
          showCategory: true,
          limit: 10,
          allLabel: "All reviews →",
          heading: "Reviews",
          description: ["Because my memory is short, but the media list is long..."],
        }
      ],
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
    })
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
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
    })
  ],
  right: [],
}

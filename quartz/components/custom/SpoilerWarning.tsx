import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"

const SpoilerWarning: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  if (fileData.frontmatter?.spoiler === true) {
    return (
      <blockquote class={`callout warning ${displayClass ?? ""}`} data-callout="warning">
        <div class="callout-title">
          <div class="callout-icon"></div>
          <div class="callout-title-inner">
            <p>This review contains spoilers. Proceed with caution if you haven't finished the story.</p>
          </div>
        </div>
      </blockquote>
    )
  }
  return null
}

export default (() => SpoilerWarning) satisfies QuartzComponentConstructor

import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from ".././types"
import { classNames } from "../../util/lang"
import style from ".././styles/custom/scoreBlock.scss"

interface RawFrontmatter {
  score?: number
}

type ScoreStatus = "good" | "okay" | "bad"

function getStatus(score: number): ScoreStatus {
  if (score >= 7) return "good"
  if (score >= 5) return "okay"
  return "bad"
}

function getVerdict(status: ScoreStatus): string {
  if (status === "good") return "Good"
  if (status === "okay") return "Mediocre"
  return "Bad"
}

const ScoreBlock: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const frontmatter = fileData.frontmatter as RawFrontmatter | undefined
  const score = frontmatter?.score

  if (score === undefined || score === null) {
    return null
  }

  const status = getStatus(score)
  const verdict = getVerdict(status)

  return (
    <div class={classNames(displayClass, "score-block-container")}>
      <div class={classNames("score-center", status)}>
        <div class="score-row">
          <div class="score-line" />
          <div class="score-number">
            <span class="score-value">{score}</span>
            <span class="score-slash">/</span>
            <span class="score-max">10</span>
          </div>
          <div class="score-line" />
        </div>
        <span class="score-verdict">{verdict}</span>
      </div>
    </div>
  )
}

ScoreBlock.css = style
export default (() => ScoreBlock) satisfies QuartzComponentConstructor

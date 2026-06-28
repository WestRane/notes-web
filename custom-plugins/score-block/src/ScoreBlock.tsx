import type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
} from "@quartz-community/types"

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
  const score = (fileData.frontmatter as { score?: number } | undefined)?.score
  if (score === undefined || score === null) return null

  const status = getStatus(Number(score))
  const verdict = getVerdict(status)
  const classes = ["score-block-container", displayClass].filter(Boolean).join(" ")

  return (
    <div class={classes}>
      <div class={`score-center ${status}`}>
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

ScoreBlock.css = `
  .score-block-container {
    margin: 2rem 0 1rem;
  }
  .score-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .score-row {
    display: flex;
    align-items: center;
    gap: 32px;
    width: 100%;
  }
  .score-line {
    flex: 1;
    height: 1px;
    background: var(--darkgray);
    opacity: 0.3;
  }
  .score-number {
    display: flex;
    align-items: baseline;
    flex-shrink: 0;
  }
  .score-value {
    font-size: 3.25rem;
    font-weight: 600;
    line-height: 1;
  }
  .score-center.good .score-value { color: #8dc63f; }
  .score-center.okay .score-value { color: #e8a020; }
  .score-center.bad  .score-value { color: #e74c3c; }
  .score-slash {
    font-size: 1rem;
    color: var(--darkgray);
    margin: 0 2px 0 4px;
  }
  .score-max {
    font-size: 1rem;
    color: var(--darkgray);
  }
  .score-verdict {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.05em;
  }
  .score-center.good .score-verdict { color: #8dc63f; }
  .score-center.okay .score-verdict { color: #e8a020; }
  .score-center.bad  .score-verdict { color: #e74c3c; }
`

export default (() => ScoreBlock) satisfies QuartzComponentConstructor

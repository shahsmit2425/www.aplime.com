import {
  homeGuides,
  guidePath,
  guideDate,
  guideReadMinutes,
  type HomeGuide,
} from "./shared/articles.js";
import { ServiceIcon } from "./client/ui.js";

export function GuideCards({ guides = homeGuides }: { guides?: HomeGuide[] }) {
  return (
    <div className="guide-grid">
      {guides.map((guide) => (
        <a className="guide-card" href={guidePath(guide)} key={guide.slug}>
          <span className="guide-card-icon">
            <ServiceIcon service={guide.service} size={28} />
          </span>
          <span className="eyebrow">{guide.category}</span>
          <h3>{guide.title}</h3>
          <p>{guide.description}</p>
          <span className="guide-card-link">
            Read guide <span aria-hidden="true">↗</span>
            <small>{guideReadMinutes(guide)} min read</small>
          </span>
        </a>
      ))}
    </div>
  );
}
export function HomeGuides({ guide }: { guide?: HomeGuide }) {
  if (!guide)
    return (
      <>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Homeowner guides</span>
        </nav>
        <header className="guides-intro">
          <p className="eyebrow">THE APLIME JOURNAL</p>
          <h1>
            A little planning.
            <br />A better home project.
          </h1>
          <p className="lede">
            Practical guides for New Jersey homeowners. Know what to ask, what
            to include, and how to compare your options before hiring.
          </p>
        </header>
        <section aria-labelledby="all-guides">
          <div className="section-heading">
            <h2 id="all-guides">Homeowner guides</h2>
            <p>From the first estimate to the final walkthrough.</p>
          </div>
          <GuideCards />
        </section>
        <section className="guide-editorial">
          <h2>Useful advice, clear limits.</h2>
          <p>
            These original Aplime guides focus on project preparation. They are
            general planning information, not a property inspection,
            professional diagnosis, or legal advice. We link to official
            resources where relevant. We do not publish local price averages
            without supporting data or imply that identity verification confirms
            a trade license.
          </p>
          <a href="/contact">Suggest a topic or report a correction →</a>
        </section>
      </>
    );
  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span aria-hidden="true">/</span>
        <a href="/blog">Homeowner guides</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{guide.category}</span>
      </nav>
      <header className="guides-intro guide-title">
        <p className="eyebrow">{guide.category}</p>
        <h1>{guide.title}</h1>
        <p className="lede">{guide.description}</p>
        <p className="guide-byline">
          By Aplime <span aria-hidden="true">·</span>{" "}
          <time dateTime={guideDate}>October 25, 2026</time>{" "}
          <span aria-hidden="true">·</span> {guideReadMinutes(guide)} min read
        </p>
      </header>
      <div className="guide-layout">
        <aside className="guide-sidebar">
          <nav aria-label="In this guide">
            <h2>In this guide</h2>
            {guide.sections.map((section) => (
              <a href={"#" + section.id} key={section.id}>
                {section.title}
              </a>
            ))}
          </nav>
          <a href="/blog">← All guides</a>
        </aside>
        <article className="guide-body" aria-label={guide.title}>
          <div className="guide-takeaway">
            <strong>Before you book</strong>
            <p>{guide.takeaway}</p>
          </div>
          {guide.sections.map((section) => (
            <section id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {section.checklist && (
                <ul className="guide-checklist">
                  {section.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          {guide.sources.length > 0 && (
            <section className="guide-sources">
              <h2>Official resources</h2>
              <ul>
                {guide.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url}>{source.title}</a>
                  </li>
                ))}
              </ul>
              <p>
                Check current guidance and local requirements before arranging
                work.
              </p>
            </section>
          )}
          <section className="guide-cta">
            <h2>Turn your checklist into a project.</h2>
            <p>
              Share your ZIP code and the work you need. Review matching
              professionals and discuss estimates before choosing.
            </p>
            <a
              className="button"
              href={
                "/app/projects/new?category=" +
                encodeURIComponent(guide.service)
              }
            >
              Start your project →
            </a>
          </section>
          <p className="guide-note">
            General planning information from Aplime. No local price survey or
            expert inspection is implied.{" "}
            <a href="/contact">Report a correction.</a>
          </p>
        </article>
      </div>
      <section className="guide-related" aria-labelledby="related-guides">
        <h2 id="related-guides">Keep planning</h2>
        <GuideCards
          guides={homeGuides
            .filter((item) => item.slug !== guide.slug)
            .slice(0, 3)}
        />
      </section>
    </>
  );
}

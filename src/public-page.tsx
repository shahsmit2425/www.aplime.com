import { categories, type Profile } from "./shared/domain.js";
import { Brand, LinkButton, ServiceIcon } from "./client/ui.js";
export const serviceCopy: Record<string, string> = {
  Handyman:
    "Get help with assembly, wall mounting, minor repairs, and the small improvements that make a home work better.",
  Cleaning:
    "Plan a regular clean, prepare for a move, or get help with a deeper reset for your space.",
  Plumbing:
    "Describe the leak, fixture, or repair you need, and discuss the scope with a plumbing professional.",
  Electrical:
    "Find help with lighting, outlets, fixtures, and electrical projects. Ask about local licensing before booking.",
  Painting:
    "Bring a fresh look to your rooms, trim, or exterior. Compare project details and written estimates.",
  Landscaping:
    "Arrange garden care, seasonal cleanup, lawn maintenance, and outdoor improvements.",
};
export function PublicPage({
  path,
  profile,
}: {
  path: string;
  profile?: Profile;
}) {
  const slug = decodeURIComponent(path.split("/")[2] || "");
  const category = categories.find((c) => c.toLowerCase() === slug);
  const legal = path === "/privacy" || path === "/terms";
  const notFound = path !== "/" && !category && !profile && !legal;
  return (
    <>
      <header className="public-header">
        <Brand />
        <nav>
          <a href="/#services">Explore services</a>
          <a href="/app/register?role=pro">For professionals</a>
          <a className="button" href="/app/login">
            Sign in
          </a>
        </nav>
      </header>
      <main className="public-main">
        {legal ? (
          <article className="panel">
            <p className="eyebrow">APLIME</p>
            <h1>
              {path === "/privacy"
                ? "Privacy information"
                : "Service information"}
            </h1>
            <p>
              Aplime connects customers and home-service professionals.
              Your account, project, and conversation information is used to
              deliver the service. Identity documents are handled by Stripe
              Identity rather than stored as project attachments.
            </p>
            <p>
              Payments are processed through Stripe. Project files are stored
              privately, and calling is provided by Daily. You can contact
              support from your account to request help or account deletion.
            </p>
            <p>
              For questions about your information or a service experience,
              contact Aplime through Help &amp; safety in your account.
            </p>
          </article>
        ) : notFound ? (
          <section className="panel">
            <h1>We couldn’t find that page.</h1>
            <LinkButton href="/">Back to home</LinkButton>
          </section>
        ) : profile ? (
          <section className="panel profile-public">
            <p className="eyebrow">
              {profile.category} · {profile.zip}
            </p>
            <h1>{profile.business}</h1>
            <p className="lede">{profile.bio}</p>
            <p>Identity verified · {profile.name}</p>
            <p>
              Starting at ${profile.rate} per hour. Final pricing is provided in
              your project estimate.
            </p>
            <LinkButton
              href={"/app/discover?pro=" + encodeURIComponent(profile.id)}
            >
              Discuss your project
            </LinkButton>
          </section>
        ) : (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">A LITTLE HELP. A HAPPIER HOME.</p>
                {category && (
                  <span className="service-hero-icon">
                    <ServiceIcon service={category} size={30} />
                  </span>
                )}
                <h1>
                  {category ? (
                    category + " services, built around your home."
                  ) : (
                    <>
                      Your next home project.
                      <br />
                      <em>In good hands.</em>
                    </>
                  )}
                </h1>
                <p className="lede">
                  {category
                    ? serviceCopy[category]
                    : "Find the right professional, compare clear estimates, and keep every conversation in one place."}
                </p>
                <div className="actions">
                  <LinkButton
                    href={
                      "/app/discover" +
                      (category ? "?category=" + category : "")
                    }
                  >
                    Find a professional
                  </LinkButton>
                  <a href="/app/register?role=pro">Grow your business →</a>
                </div>
                <div className="trust-row" aria-label="Why use Aplime">
                  <span><b>✓</b><strong>Trusted professionals</strong></span>
                  <span><b>◆</b><strong>Safe and reliable</strong></span>
                  <span><b>◷</b><strong>Fast booking</strong></span>
                  <span><b>⌁</b><strong>A happier home</strong></span>
                </div>
              </div>
              <div className="hero-image">
                <img
                  src="/home.jpg"
                  alt="A welcoming living room with a blue sofa"
                  width="960"
                  height="960"
                />
                <div>
                  <strong>Less on your to-do list.</strong>
                  <span>More room for what matters.</span>
                </div>
              </div>
            </section>
            <section id="services">
              <div className="section-heading">
                <p className="eyebrow">EVERYDAY HELP, THOUGHTFULLY CONNECTED</p>
                <h2>What can we help you with?</h2>
              </div>
              <div className="service-grid">
                {categories.map((c, i) => (
                  <a
                    href={"/services/" + c.toLowerCase()}
                    className="service-card"
                    key={c}
                  >
                    <span className="service-card-top">
                      <span className="service-icon">
                        <ServiceIcon service={c} size={27} />
                      </span>
                      <span className="service-number">0{i + 1}</span>
                    </span>
                    <h3>{c}</h3>
                    <p>{serviceCopy[c]}</p>
                    <strong>Explore {c.toLowerCase()} →</strong>
                  </a>
                ))}
              </div>
            </section>
            <section className="how">
              <div>
                <p className="eyebrow">FROM IDEA TO DONE</p>
                <h2>A simpler way to care for your home.</h2>
              </div>
              {[
                "Tell us what you need",
                "Choose the right professional",
                "Keep the details together",
              ].map((s, i) => (
                <article key={s}>
                  <span>0{i + 1}</span>
                  <h3>{s}</h3>
                  <p>
                    {
                      [
                        "Describe your project and the location where you need help.",
                        "Review profiles and written estimates before making a choice.",
                        "Use project messages, calls, scheduling, and secure checkout.",
                      ][i]
                    }
                  </p>
                </article>
              ))}
            </section>
          </>
        )}
      </main>
      <footer className="public-footer">
        <Brand />
        <p>Built around your home.</p>
        <nav>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Service information</a>
          <a href="/app/help">Get help</a>
        </nav>
      </footer>
    </>
  );
}

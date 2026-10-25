import { T } from "./shared/language.js";
import { serviceSlug } from "./shared/service-questionnaires.js";
import { ArrowUpRight } from "lucide-react";
import { Menu, MessageCircle, FileText } from "lucide-react";
import { BusinessDisplay } from "./client/business-display.js";
import { categories, type Profile } from "./shared/domain.js";
import { Brand, LinkButton, ServiceIcon } from "./client/ui.js";
import {
  generalFaqs,
  informationalPages,
  serviceSeoContent,
} from "./shared/seo-content.js";
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
  "Junk Removal":
    "Arrange pickup for unwanted furniture, appliances, clutter, and debris.",
  HVAC: "Find help with heating, cooling, maintenance, and system replacement.",
  Roofing:
    "Discuss roof repairs, inspections, and replacement with local professionals.",
  "Tree Services":
    "Plan tree trimming, removal, stump work, and tree health assessments.",
  "Appliance Repair":
    "Get help diagnosing and repairing everyday household appliances.",
  "Pest Control":
    "Discuss pest inspections, treatment, and prevention for your property.",
  Landscaping:
    "Arrange garden care, seasonal cleanup, lawn maintenance, and outdoor improvements.",
};

function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">
        <T>{"Home"}</T>
      </a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}

function ServicesIndex() {
  return (
    <>
      <Breadcrumbs current="Services" />
      <section className="seo-intro">
        <p className="eyebrow">HOME SERVICES</p>
        <h1>Plan your next home project with clearer information.</h1>
        <p className="lede">
          Explore common project types, learn what to include in your request,
          and compare approved professional profiles and written estimates.
        </p>
      </section>
      <section className="service-grid" aria-label="Home service categories">
        {categories.map((category, index) => (
          <a
            className="service-card"
            href={"/services/" + serviceSlug(category)}
            key={category}
          >
            <span className="service-card-top">
              <span className="service-icon">
                <ServiceIcon service={category} size={27} />
              </span>
              <span className="service-number">
                {String(index + 1).padStart(2, "0")}
              </span>
            </span>
            <h2>{serviceSeoContent[category].title}</h2>
            <p>{serviceCopy[category]}</p>
            <strong>Explore {category.toLowerCase()} →</strong>
          </a>
        ))}
      </section>
      <section className="seo-callout">
        <h2>Not sure where to start?</h2>
        <p>
          Create a request with photos and project details. You can discuss the
          work and compare estimates before selecting a professional.
        </p>
        <LinkButton href="/app/projects/new">
          <T>{"Start a project"}</T>
        </LinkButton>
      </section>
    </>
  );
}

function ServicePage({ category }: { category: (typeof categories)[number] }) {
  const content = serviceSeoContent[category];
  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">
          <T>{"Home"}</T>
        </a>
        <span aria-hidden="true">/</span>
        <a href="/services">
          <T>{"Services"}</T>
        </a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{category}</span>
      </nav>
      <section className="seo-service-hero">
        <div>
          <span className="service-hero-icon">
            <ServiceIcon service={category} size={30} />
          </span>
          <p className="eyebrow">{category.toUpperCase()} PROJECTS</p>
          <h1>{content.title}</h1>
          <p className="lede">{content.introduction}</p>
          <div className="actions">
            <LinkButton
              href={
                "/app/projects/new?category=" + encodeURIComponent(category)
              }
            >
              Find {category.toLowerCase()} professionals
            </LinkButton>
            <a href="/how-it-works">See how Aplime works →</a>
          </div>
        </div>
        <aside className="seo-quick-facts">
          <strong>Prepare a useful request</strong>
          <ul>
            {content.projectTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </aside>
      </section>
      <section className="seo-section">
        <div className="section-heading">
          <p className="eyebrow">COMMON PROJECTS</p>
          <h2>What {category.toLowerCase()} professionals can help discuss</h2>
        </div>
        <div className="seo-list-grid">
          {content.commonJobs.map((job) => (
            <article key={job}>
              <ServiceIcon service={category} size={21} />
              <h3>{job}</h3>
            </article>
          ))}
        </div>
        <p className="seo-disclaimer">
          Services, credentials, and availability vary by business and location.
          Review the professional’s profile and confirm applicable licenses,
          insurance, permits, and project requirements directly.
        </p>
      </section>
      <section className="seo-process">
        <div>
          <p className="eyebrow">A CLEARER PROCESS</p>
          <h2>From request to confirmed completion</h2>
        </div>
        {[
          [
            "Share the scope",
            "Answer service-specific questions and add up to five helpful photos.",
          ],
          [
            "Compare the details",
            "Discuss the work and review labor, materials, timing, and exclusions.",
          ],
          [
            "Confirm each step",
            "Choose a professional, agree on an appointment, and confirm completion.",
          ],
        ].map(([title, body], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <section className="seo-faq" aria-labelledby="faq-title">
        <p className="eyebrow">HELPFUL ANSWERS</p>
        <h2 id="faq-title">{category} service questions</h2>
        {content.faqs.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </section>
      <section className="seo-related">
        <h2>Explore other home services</h2>
        <nav aria-label="Related services">
          {categories
            .filter((item) => item !== category)
            .map((item) => (
              <a href={"/services/" + serviceSlug(item)} key={item}>
                <ServiceIcon service={item} size={18} />
                {item}
              </a>
            ))}
        </nav>
      </section>
    </>
  );
}

function InformationPage({ path }: { path: string }) {
  const page = informationalPages[path as keyof typeof informationalPages];
  const sections =
    path === "/how-it-works"
      ? [
          [
            "1. Describe the project",
            "Choose a service, answer detailed questions, add a budget or preferred time when useful, and upload up to five photos.",
          ],
          [
            "2. Discuss and compare",
            "Use private messages, audio or video calls, and itemized written estimates to understand the scope.",
          ],
          [
            "3. Choose and schedule",
            "Accept the estimate that fits, then use appointment proposals so both people confirm the time.",
          ],
          [
            "4. Track and finish",
            "Keep updates with the project. The professional requests completion and the customer confirms it before reviewing.",
          ],
        ]
      : path === "/for-professionals"
        ? [
            [
              "Build a complete listing",
              "Add business details, service coverage, policies, credentials, a logo or cover, and examples of work.",
            ],
            [
              "Complete review",
              "Verify your identity through Stripe Identity and submit the saved listing for Aplime administrator review.",
            ],
            [
              "Receive relevant opportunities",
              "Approved, subscribed businesses receive matching projects in their category and configured service radius.",
            ],
            [
              "Set clear expectations",
              "Ask questions, use private calls, send itemized estimates, and confirm appointment and completion updates.",
            ],
          ]
        : path === "/trust-and-safety"
          ? [
              [
                "Identity and profile review",
                "Stripe Identity verifies the account holder. Aplime separately reviews business-profile content before publication.",
              ],
              [
                "Know the limits",
                "Identity verification does not prove licensing, insurance, qualifications, or work quality. Confirm those items with the business and issuing authority.",
              ],
              [
                "Keep records together",
                "Use project discussions for scope, estimates, appointment proposals, and important changes. Block or report concerning communication.",
              ],
              [
                "Handle urgent danger elsewhere",
                "Aplime is not an emergency service. Contact emergency services or the appropriate utility for fire, flooding, gas, live wiring, or immediate danger.",
              ],
            ]
          : [
              [
                "For customers",
                "Aplime turns a broad home project into a structured request that professionals can understand and discuss.",
              ],
              [
                "For professionals",
                "Aplime provides a business profile and workspace for relevant opportunities, estimates, conversations, scheduling, and reviews.",
              ],
              [
                "A subscription marketplace",
                "Professionals pay Aplime for membership. Customers and professionals arrange service payment directly; Aplime does not process project payments.",
              ],
            ];
  return (
    <>
      <Breadcrumbs current={page.title} />
      <section className="seo-intro">
        <p className="eyebrow">APLIME</p>
        <h1>{page.heading}</h1>
        <p className="lede">{page.description}</p>
      </section>
      <section className="seo-editorial-grid">
        {sections.map(([title, body]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <section className="seo-callout">
        <h2>
          {path === "/for-professionals"
            ? "Ready to build your business profile?"
            : "Ready to plan a home project?"}
        </h2>
        <LinkButton
          href={
            path === "/for-professionals"
              ? "/app/register?role=pro"
              : "/app/projects/new"
          }
        >
          {path === "/for-professionals"
            ? "Join as a professional"
            : "Start a project"}
        </LinkButton>
      </section>
    </>
  );
}
function FaqPage({ path }: { path: string }) {
  const page = informationalPages[path as keyof typeof informationalPages];
  return (
    <>
      <Breadcrumbs current={page.title} />
      <section className="seo-intro">
        <p className="eyebrow">HELPFUL ANSWERS</p>
        <h1>{page.heading}</h1>
        <p className="lede">{page.description}</p>
      </section>
      {generalFaqs.map((group, index) => (
        <section
          className="seo-faq"
          aria-labelledby={"faq-group-" + index}
          key={group.heading}
        >
          <h2 id={"faq-group-" + index}>{group.heading}</h2>
          {group.items.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </section>
      ))}
      <section className="seo-callout">
        <h2>Still have a question?</h2>
        <LinkButton href="/contact">Contact Aplime</LinkButton>
      </section>
    </>
  );
}

function ContactPage({
  path,
  supportEmail,
}: {
  path: string;
  supportEmail?: string;
}) {
  const page = informationalPages[path as keyof typeof informationalPages];
  return (
    <>
      <Breadcrumbs current={page.title} />
      <section className="seo-intro">
        <p className="eyebrow">CONTACT</p>
        <h1>{page.heading}</h1>
        <p className="lede">{page.description}</p>
      </section>
      <section className="seo-editorial-grid">
        <article>
          <h2>If you have an account</h2>
          <p>
            Sign in and open Help to message the Aplime team about a project, a
            professional, billing, or your listing. Your conversation and its
            status stay in your account.
          </p>
          <p>
            <a href="/app/help">Open Help</a>
          </p>
        </article>
        {supportEmail ? (
          <article>
            <h2>By email</h2>
            <p>
              Write to <a href={"mailto:" + supportEmail}>{supportEmail}</a> if
              you cannot sign in or have a question before creating an account.
            </p>
          </article>
        ) : null}
        <article>
          <h2>Your data</h2>
          <p>
            Download a copy of your data or delete your account from Settings
            after signing in.
          </p>
        </article>
        <article>
          <h2>Urgent problems at home</h2>
          <p>
            Aplime is not an emergency service. For fire, flooding, gas, live
            wiring, or immediate danger, contact emergency services or the
            appropriate utility.
          </p>
        </article>
      </section>
      <section className="seo-callout">
        <h2>Looking for quick answers?</h2>
        <LinkButton href="/faq">Read the FAQ</LinkButton>
      </section>
    </>
  );
}

function NotFoundPage() {
  return (
    <>
      <section className="seo-intro">
        <p className="eyebrow">PAGE NOT FOUND</p>
        <h1>We couldn’t find that page.</h1>
        <p className="lede">
          The link may be out of date or mistyped. Try one of these instead.
        </p>
        <div className="actions">
          <LinkButton href="/">
            <T>{"Back to home"}</T>
          </LinkButton>
          <a href="/services">Browse all services →</a>
        </div>
      </section>
      <section className="seo-related">
        <h2>Popular services</h2>
        <nav aria-label="Services">
          {categories.map((item) => (
            <a href={"/services/" + serviceSlug(item)} key={item}>
              <ServiceIcon service={item} size={18} />
              {item}
            </a>
          ))}
        </nav>
      </section>
      <section className="seo-related">
        <h2>Need help?</h2>
        <nav aria-label="Help">
          <a href="/faq">Frequently asked questions</a>
          <a href="/contact">Contact Aplime</a>
          <a href="/app/login">
            <T>{"Sign in"}</T>
          </a>
        </nav>
      </section>
    </>
  );
}

export function PublicPage({
  path,
  profile,
  supportEmail,
}: {
  path: string;
  profile?: Profile;
  supportEmail?: string;
}) {
  const slug = decodeURIComponent(path.split("/")[2] || "");
  const category = categories.find((c) => serviceSlug(c) === slug);
  const information =
    informationalPages[path as keyof typeof informationalPages];
  const servicesIndex = path === "/services";
  const legal = path === "/privacy" || path === "/terms";
  const notFound =
    path !== "/" &&
    !category &&
    !profile &&
    !legal &&
    !information &&
    !servicesIndex;
  return (
    <>
      <a className="skip-link" href="#main-content">
        <T>{"Skip to content"}</T>{" "}
      </a>
      <header className="public-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="/#services">
            <T>{"Explore services"}</T>
          </a>
          <a href="/how-it-works">
            <T>{"How it works"}</T>
          </a>
          <a href="/for-professionals">
            <T>{"For professionals"}</T>
          </a>
          <a className="button" href="/app/login">
            <T>{"Sign in"}</T>{" "}
          </a>
        </nav>
        <details className="public-mobile-nav">
          <summary aria-label="Open navigation">
            <Menu />
          </summary>
          <div>
            <a href="/services">
              <T>{"Explore services"}</T>
            </a>
            <a href="/how-it-works">
              <T>{"How it works"}</T>
            </a>
            <a href="/for-professionals">
              <T>{"For professionals"}</T>
            </a>
            <a href="/trust-and-safety">
              <T>{"Trust & safety"}</T>
            </a>
            <a href="/app/projects/new">
              <T>{"Start a project"}</T>
            </a>
          </div>
        </details>
      </header>
      <main className="public-main" id="main-content">
        {legal ? (
          <article className="panel">
            <p className="eyebrow">APLIME</p>
            <h1>
              {path === "/privacy"
                ? "Privacy information"
                : "Service information"}
            </h1>
            <p>
              Aplime connects customers and home-service professionals. Your
              account, project, and conversation information is used to deliver
              the service. Identity documents are handled by Stripe Identity
              rather than stored as project attachments.
            </p>
            <p>
              Professional subscriptions are billed through Stripe. Customers
              and professionals arrange service payments directly. Project files
              are stored privately, and calling is provided by Daily. You can
              contact support from your account to request help or account
              deletion.
            </p>
            <p>
              Authorized Aplime administrators can review account and business
              details, project information, project conversations and uploaded
              files for support, marketplace operations and safety. Access to
              detailed records is logged. You can communicate directly with
              Aplime through support conversations in Messages. Aplime does not
              record audio or video calls in this application.
            </p>
            <p>
              For questions about your information or a service experience,
              contact Aplime through Messages in your account.
            </p>
          </article>
        ) : notFound ? (
          <NotFoundPage />
        ) : profile ? (
          <section className="profile-public">
            <BusinessDisplay profile={profile} />
            <div className="business-public-action">
              <LinkButton
                href={
                  "/app/projects/new?category=" +
                  encodeURIComponent(profile.category)
                }
              >
                Start a project to get matched
              </LinkButton>
            </div>
          </section>
        ) : path === "/faq" ? (
          <FaqPage path={path} />
        ) : path === "/contact" ? (
          <ContactPage path={path} supportEmail={supportEmail} />
        ) : information ? (
          <InformationPage path={path} />
        ) : servicesIndex ? (
          <ServicesIndex />
        ) : category ? (
          <ServicePage category={category} />
        ) : (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">
                  <T>{"A LITTLE HELP. A HAPPIER HOME."}</T>
                </p>
                <h1>
                  <T>{"Your next home project."}</T> <br />
                  <em>
                    <T>{"In good hands."}</T>
                  </em>
                </h1>
                <p className="lede">
                  <T>
                    {
                      "Find the right professional, compare clear estimates, and keep every conversation in one place."
                    }
                  </T>{" "}
                </p>
                <form
                  className="hero-project-start"
                  action="/app/projects/new"
                  method="get"
                >
                  <label htmlFor="hero-project-zip">
                    <T>{"Where is your project?"}</T>{" "}
                  </label>
                  <div>
                    <input
                      id="hero-project-zip"
                      name="zip"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      pattern="[0-9]{5}"
                      maxLength={5}
                      required
                      placeholder="ZIP code"
                    />
                    <button type="submit">
                      <T>{"Find my pros"}</T> <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <small>
                    <T>
                      {
                        "Serving New Jersey · Start now, sign in at the last step."
                      }
                    </T>{" "}
                  </small>
                </form>
                <a href="/app/register?role=pro">
                  <T>{"Grow your business →"}</T>
                </a>
                <div className="trust-row" aria-label="Project tools">
                  <span>
                    <MessageCircle size={17} />
                    <strong>
                      <T>{"Direct conversations"}</T>
                    </strong>
                  </span>
                  <span>
                    <FileText size={17} />
                    <strong>
                      <T>{"Clear estimates"}</T>
                    </strong>
                  </span>
                </div>
              </div>
            </section>
            <section id="services">
              <div className="section-heading">
                <p className="eyebrow">
                  <T>{"SERVICES FOR YOUR HOME"}</T>
                </p>
                <h2>
                  <T>{"What can we help you with?"}</T>
                </h2>
              </div>
              <div className="home-service-grid">
                {categories.map((c) => (
                  <a
                    href={"/app/projects/new?category=" + encodeURIComponent(c)}
                    className="home-service-tile"
                    key={c}
                  >
                    <span className="home-service-symbol">
                      <ServiceIcon service={c} size={36} />
                    </span>
                    <span>
                      <T>{c === "HVAC" ? "Heating & cooling" : c}</T>
                    </span>
                  </a>
                ))}
              </div>
              <a className="service-guide-link" href="/services">
                <T>{"Explore service guides"}</T> <ArrowUpRight size={17} />
              </a>
            </section>
            <section className="how">
              <div>
                <p className="eyebrow">
                  <T>{"FROM IDEA TO DONE"}</T>
                </p>
                <h2>
                  <T>{"A simpler way to care for your home."}</T>
                </h2>
              </div>
              {[
                "Tell us what you need",
                "Choose the right professional",
                "Keep the details together",
              ].map((s, i) => (
                <article key={s}>
                  <span>0{i + 1}</span>
                  <h3>
                    <T>{s}</T>
                  </h3>
                  <p>
                    {
                      [
                        "Describe your project and the location where you need help.",
                        "Review profiles and written estimates before making a choice.",
                        "Use project messages, calls, scheduling, and status updates.",
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
        <p>
          <T>{"Built around your home."}</T>
        </p>
        <nav>
          <a href="/privacy">
            <T>{"Privacy"}</T>
          </a>
          <a href="/terms">
            <T>{"Service information"}</T>
          </a>
          <a href="/trust-and-safety">
            <T>{"Trust & safety"}</T>
          </a>
          <a href="/about">
            <T>{"About"}</T>
          </a>
          <a href="/faq">
            <T>{"FAQ"}</T>
          </a>
          <a href="/contact">
            <T>{"Contact"}</T>
          </a>
          <a href="/app/help">
            <T>{"Get help"}</T>
          </a>
        </nav>
      </footer>
    </>
  );
}

import { MapPin } from "lucide-react";
import { ProfessionalCard } from "./client/marketplace-cards.js";
import { LinkButton, ServiceIcon } from "./client/ui.js";
import { categories, type Profile } from "./shared/domain.js";
import {
  businessServices,
  localServicePages,
  newJerseyBusinesses,
  projectStartUrl,
  servicePagePath,
  type LocalServicePage,
} from "./shared/new-jersey.js";
import { serviceSeoContent } from "./shared/seo-content.js";
export function LocalBusinesses({
  profiles,
  heading = "Meet New Jersey businesses",
  category,
  limit = 6,
}: {
  profiles: Profile[];
  heading?: string;
  category?: string;
  limit?: number;
}) {
  const businesses = newJerseyBusinesses(profiles)
    .filter((p) => !category || businessServices(p).some((c) => c === category))
    .slice(0, limit);
  if (!businesses.length) return null;
  return (
    <section className="seo-local-businesses" aria-label={heading}>
      <div className="section-heading">
        <p className="eyebrow">LOCAL BUSINESS PROFILES</p>
        <h2>{heading}</h2>
        <p>
          Explore services, real work photos and customer reviews. Confirm
          coverage for your address before choosing a professional.
        </p>
      </div>
      <div className="seo-business-list">
        {businesses.map((p) => (
          <ProfessionalCard
            key={p.id}
            profile={p}
            save={null}
            layout="horizontal"
            actions={
              <a
                className="button"
                href={"/professionals/" + encodeURIComponent(p.id)}
              >
                View business profile
              </a>
            }
          >
            {!p.available && (
              <p className="availability-note">
                Not accepting new requests right now.
              </p>
            )}
          </ProfessionalCard>
        ))}
      </div>
    </section>
  );
}
export function CoverageLinks({
  profiles,
  category,
}: {
  profiles: Profile[];
  category?: string;
}) {
  const pages = localServicePages(profiles).filter(
    (p) => !category || p.category === category,
  );
  if (!pages.length)
    return (
      <p className="seo-coverage-note">
        Coverage depends on the businesses available for your project address.
        Submit your address to check current matches; Aplime currently focuses
        on New Jersey.
      </p>
    );
  const towns = [...new Set(pages.map((p) => p.slug))];
  return (
    <div className="seo-town-grid">
      {towns.map((slug) => {
        const local = pages.filter((p) => p.slug === slug);
        return (
          <article key={slug}>
            <h3>
              <MapPin size={19} />
              {local[0].town}, NJ
            </h3>
            <p>Businesses based here</p>
            <nav aria-label={local[0].town + " services"}>
              {local.map((p) => (
                <a key={p.path} href={p.path}>
                  {p.category}
                  <span>
                    {p.profiles.length}{" "}
                    {p.profiles.length === 1 ? "business" : "businesses"}
                  </span>
                </a>
              ))}
            </nav>
          </article>
        );
      })}
    </div>
  );
}
export function NewJerseyPage({ profiles }: { profiles: Profile[] }) {
  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span>/</span>
        <span aria-current="page">New Jersey</span>
      </nav>
      <section className="seo-service-hero">
        <div>
          <p className="eyebrow">CURRENTLY SERVING NEW JERSEY</p>
          <h1>Home services in New Jersey, organized around your project.</h1>
          <p className="lede">
            Find a local business for cleaning, repairs and home improvements.
            Share what you need, compare profiles and estimates, and keep the
            conversation together.
          </p>
          <div className="actions">
            <LinkButton href={projectStartUrl()}>Post a project</LinkButton>
            <a href="/how-it-works">How Aplime works</a>
          </div>
        </div>
        <aside className="seo-quick-facts">
          <strong>Check your service coverage</strong>
          <p>
            A business’s base town is a starting point. Matches depend on your
            full project address, the service category and the professional’s
            selected service area.
          </p>
          <p>
            No project payment is collected by Aplime. Agree on the work and
            payment directly with your professional.
          </p>
        </aside>
      </section>
      <section className="seo-section">
        <div className="section-heading">
          <h2>Choose your home service</h2>
        </div>
        <div className="service-grid">
          {categories.map((c) => (
            <a className="service-card" key={c} href={servicePagePath(c)}>
              <ServiceIcon service={c} size={25} />
              <h3>{c}</h3>
              <p>{serviceSeoContent[c].description}</p>
              <strong>Explore {c.toLowerCase()} →</strong>
            </a>
          ))}
        </div>
      </section>
      <section className="seo-section">
        <div className="section-heading">
          <h2>Explore local business areas</h2>
          <p>
            These pages show reviewed businesses based in each town. Their
            service radius may include nearby areas; check your exact address
            when posting.
          </p>
        </div>
        <CoverageLinks profiles={profiles} />
      </section>
      <LocalBusinesses profiles={profiles} />
      <section className="seo-callout">
        <h2>Have a project in mind?</h2>
        <p>
          Add your address, service details and up to five photos. A
          professional may ask for an assessment before providing a price.
        </p>
        <LinkButton href={projectStartUrl()}>
          Tell us about your project
        </LinkButton>
      </section>
    </>
  );
}
export function TownServicePage({ page }: { page: LocalServicePage }) {
  const content = serviceSeoContent[page.category];
  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span>/</span>
        <a href="/new-jersey">New Jersey</a>
        <span>/</span>
        <span aria-current="page">
          {page.category} in {page.town}
        </span>
      </nav>
      <section className="seo-service-hero">
        <div>
          <p className="eyebrow">{page.town.toUpperCase()}, NEW JERSEY</p>
          <h1>
            {page.category} professionals in {page.town}, NJ.
          </h1>
          <p className="lede">
            Compare {page.category.toLowerCase()} businesses based in{" "}
            {page.town}. View their services, portfolios and reviews before
            discussing your project.
          </p>
          <div className="actions">
            <LinkButton href={projectStartUrl(page.category, page.town)}>
              Post a {page.category.toLowerCase()} project
            </LinkButton>
            <a href={servicePagePath(page.category)}>Read the service guide</a>
          </div>
        </div>
        <aside className="seo-quick-facts">
          <strong>Plan your {page.town} project</strong>
          <ul>
            {content.projectTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </aside>
      </section>
      <LocalBusinesses
        profiles={page.profiles}
        heading={`${page.profiles.length} ${page.category.toLowerCase()} ${page.profiles.length === 1 ? "business" : "businesses"} based in ${page.town}`}
        category={page.category}
        limit={200}
      />
      <section className="seo-editorial-grid">
        <article>
          <h2>Confirm your address is covered</h2>
          <p>
            A {page.town} business address does not guarantee every nearby
            property is covered. Your exact project address and the
            professional’s service preferences determine matching. The address
            remains private before a professional is selected.
          </p>
        </article>
        <article>
          <h2>Discuss the scope before pricing</h2>
          <p>
            {content.introduction} Professionals can request an assessment
            first, then add a total price and estimated days to finish. Aplime
            does not collect payment for the work.
          </p>
        </article>
      </section>
      <section className="seo-faq">
        <h2>
          Planning {page.category.toLowerCase()} in {page.town}
        </h2>
        {content.faqs.map((f) => (
          <details key={f.question}>
            <summary>{f.question}</summary>
            <p>{f.answer}</p>
          </details>
        ))}
      </section>
      <section className="seo-related">
        <h2>Explore nearby business areas</h2>
        <a href="/new-jersey">View New Jersey coverage →</a>
        <a href={servicePagePath(page.category)}>
          All New Jersey {page.category.toLowerCase()} information →
        </a>
      </section>
    </>
  );
}

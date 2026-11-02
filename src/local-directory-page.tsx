import { categories } from "./shared/domain.js";
import { serviceSlug } from "./shared/service-questionnaires.js";
import {
  directoryPaths,
  indexableLocation,
  locationPage,
  locationHeading,
  municipalities,
  pageListings,
  uniquePros,
  type LocalDirectory,
  type LocationPage,
} from "./shared/local-directory.js";

export function LocationLinks({
  directory,
  service,
}: {
  directory: LocalDirectory;
  service?: string;
}) {
  const paths = directoryPaths(directory).filter(
    (p) => p !== "/nj" && (!service || locationPage(p)?.service === service),
  );
  return (
    <section className="local-links" aria-label="New Jersey service areas">
      <h2>
        {service
          ? `${service} service areas`
          : "Explore New Jersey service areas"}
      </h2>
      <a href="/nj">New Jersey directory</a>
      {paths.length > 0 && (
        <ul>
          {paths.map((path) => (
            <li key={path}>
              <a href={path}>{locationHeading(locationPage(path)!)}</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LocalDirectoryPage({
  page,
  directory,
}: {
  page: LocationPage;
  directory: LocalDirectory;
}) {
  const listings = pageListings(page, directory);
  const pros = uniquePros(listings);
  const paths = directoryPaths(directory);
  const parent = page.municipalityId
    ? `/nj/${municipalities.find((m) => m.id === page.municipalityId)!.slug}`
    : page.county
      ? `/nj/counties/${page.county}`
      : "/nj";
  const county = page.county ? `/nj/counties/${page.county}` : undefined;
  return (
    <div className="local-directory">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span aria-hidden="true">/</span>
        {page.path !== "/nj" && (
          <>
            <a href="/nj">New Jersey</a>
            <span aria-hidden="true">/</span>
          </>
        )}
        {county && county !== page.path && paths.includes(county) && (
          <>
            <a href={county}>{locationPage(county)!.name}</a>
            <span aria-hidden="true">/</span>
          </>
        )}
        {page.service && parent !== county && paths.includes(parent) && (
          <>
            <a href={parent}>{page.name}</a>
            <span aria-hidden="true">/</span>
          </>
        )}
        <span aria-current="page">{page.service || page.name}</span>
      </nav>
      <section className="local-intro">
        <p className="eyebrow">NEW JERSEY HOME SERVICES</p>
        <h1>{locationHeading(page)}</h1>
        <p>
          Review business profiles, describe your project, and request written
          estimates. Message professionals or arrange a call before choosing who
          to hire.
        </p>
        <p>
          {pros.length
            ? `${pros.length} ${pros.length === 1 ? "business has" : "businesses have"} reviewed service coverage for ${page.name}. Exact address, job scope, and availability still need confirmation.`
            : "We are building our New Jersey network. There are no businesses with reviewed coverage listed here yet."}
        </p>
        {pros.length > 0 && !indexableLocation(page, directory) && (
          <p className="local-notice">
            Our selection in this area is currently limited. You can view the
            available profiles below; multiple estimates are not guaranteed.
          </p>
        )}
        <form action="/app/projects/new" method="get" className="local-request">
          {page.service ? (
            <input type="hidden" name="category" value={page.service} />
          ) : (
            <label>
              Service
              <select name="category" required defaultValue="">
                <option value="" disabled>
                  Choose a service
                </option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Your project's ZIP code
            <input
              name="zip"
              inputMode="numeric"
              autoComplete="postal-code"
              pattern="[0-9]{5}"
              maxLength={5}
              placeholder="5-digit ZIP code"
              required
              aria-describedby="local-zip-note"
            />
          </label>
          <button type="submit">Request written estimates</button>
        </form>
        <p id="local-zip-note" className="local-muted">
          Enter the ZIP for the actual work address. You can start without
          signing in. Sending a request does not book a service or guarantee a
          match.
        </p>
      </section>
      {pros.length > 0 && (
        <section
          aria-label="Professionals serving this area"
          className="local-pros"
        >
          <h2>
            {page.service
              ? `${page.service} professionals`
              : "Professionals serving this area"}
          </h2>
          {pros.map((pro) => (
            <article className="local-pro" key={pro.id}>
              <div className="local-pro-heading">
                <h3>
                  <a href={`/professionals/${encodeURIComponent(pro.id)}`}>
                    {pro.business}
                  </a>
                </h3>
                <span>
                  {pro.reviewCount > 0
                    ? `${Number(pro.rating).toFixed(1)} / 5 · ${pro.reviewCount} ${pro.reviewCount === 1 ? "review" : "reviews"}`
                    : "No reviews yet"}
                </span>
              </div>
              <p className="local-muted">
                Identity verified · Profile reviewed by Aplime
              </p>
              <p>{pro.bio}</p>
              <ul className="local-services">
                {[
                  ...new Set(
                    listings
                      .filter((l) => l.pro.id === pro.id)
                      .map((l) => l.service),
                  ),
                ].map((s) => (
                  <li key={s}>
                    <a href={`/services/${serviceSlug(s)}`}>{s}</a>
                  </li>
                ))}
              </ul>
              {!!pro.images?.length && (
                <div className="local-photos">
                  {pro.images.map((image, i) => (
                    <a
                      href={`/professionals/${encodeURIComponent(pro.id)}`}
                      key={image.id}
                      aria-label={`View ${pro.business}'s portfolio`}
                    >
                      <img
                        src={image.url}
                        alt={`${pro.business} past work photo ${i + 1}`}
                        loading="lazy"
                        width="240"
                        height="160"
                      />
                    </a>
                  ))}
                </div>
              )}
              <a
                className="button"
                href={`/professionals/${encodeURIComponent(pro.id)}`}
              >
                View business profile
              </a>
            </article>
          ))}
        </section>
      )}
      <section className="local-expectations">
        <h2>Before you choose a professional</h2>
        <p>
          Identity verification and profile review do not verify a trade
          license, insurance, or quality of work. Ask the business for
          applicable credentials and confirm your scope, price, and timing in
          writing.
        </p>
        <p>
          Customers use Aplime free. Pros pay a membership. You pay your
          professional directly; Aplime does not process service payments. Ask
          whether a visit or assessment has a charge.
        </p>
        <a href="/trust-and-safety">How verification works</a> ·{" "}
        <a href="/how-it-works">How Aplime works</a>
      </section>
      <section className="local-links">
        <h2>Explore services</h2>
        <ul>
          {categories.map((c) => (
            <li key={c}>
              <a href={`/services/${serviceSlug(c)}`}>{c}</a>
            </li>
          ))}
        </ul>
      </section>
      <LocationLinks directory={directory} service={page.service} />
    </div>
  );
}

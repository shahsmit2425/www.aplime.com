import {
  listingChanges,
  type PublishedListing,
} from "../../src/shared/admin.js";
import type { Profile } from "../../src/shared/domain.js";

type Images = PublishedListing["images"];
function Photos({ heading, images }: { heading: string; images: Images }) {
  if (!images.length) return null;
  return (
    <>
      <h3>{heading}</h3>
      <div className="admin-change-photos">
        {images.map((image) => (
          <figure key={image.id}>
            {image.url ? (
              <a href={image.url} target="_blank" rel="noreferrer">
                <img src={image.url} alt="" />
              </a>
            ) : (
              <p>Image storage unavailable</p>
            )}
            <figcaption>{image.slot.replace("-", " ")}</figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
// Approved listing beside the edits waiting for a decision.
export function ListingChanges({
  published,
  profile,
}: {
  published: PublishedListing;
  profile: Profile;
}) {
  const { fields, addedImages, removedImages } = listingChanges(
    published,
    profile,
  );
  if (!fields.length && !addedImages.length && !removedImages.length)
    return (
      <p className="admin-muted">
        The saved profile matches the approved listing customers see.
      </p>
    );
  return (
    <>
      {fields.length > 0 && (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Approved listing</th>
                <th scope="col">Proposed change</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.label}>
                  <th scope="row">{field.label}</th>
                  <td>{field.before || "—"}</td>
                  <td>{field.after || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Photos heading="Photos added" images={addedImages} />
      <Photos heading="Photos removed" images={removedImages} />
    </>
  );
}

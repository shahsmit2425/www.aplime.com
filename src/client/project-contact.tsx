import { useEffect, useState } from "react";
import { request } from "./api.js";
import { T } from "../shared/language.js";
export function ProjectContact({ projectId }: { projectId: string }) {
  const [contact, setContact] = useState<{ phone: string } | null>(null);
  useEffect(() => {
    let active = true;
    setContact(null);
    request<{ phone: string } | null>(`/projects/${projectId}/contact`)
      .then((c) => {
        if (active) setContact(c);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [projectId]);
  return contact ? (
    <section className="project-contact-card">
      <strong>
        <T>Project contact</T>
      </strong>
      <a href={`tel:${contact.phone}`}>{contact.phone}</a>
      <small>
        <T>Customer permission: calls or texts about this project only.</T>
      </small>
    </section>
  ) : null;
}

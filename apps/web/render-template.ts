export function renderTemplate(
  template: string,
  page: { head: string; html: string; bootstrap: string },
  nonce: string,
) {
  const fragments: Record<string, string> = {
    head: page.head.replaceAll("<script ", () => `<script nonce="${nonce}" `),
    app: page.html,
    bootstrap: page.bootstrap.replace(
      "<script>",
      () => `<script nonce="${nonce}">`,
    ),
  };
  return template.replace(
    /<!--(head|app|bootstrap)-->/g,
    (_, slot: string) => fragments[slot],
  );
}

export function SetupNotice({
  requirements,
  onContinue,
}: {
  requirements: string[];
  onContinue: () => void;
}) {
  return (
    <aside className="setup-notice" aria-label="Business setup required">
      <div>
        <strong>Ready to respond?</strong>
        <p>Finish your business setup to chat and send estimates.</p>
        <details>
          <summary>What’s left to do</summary>
          <ul>
            {requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </div>
      <button onClick={onContinue}>
        Finish setup <span aria-hidden="true">→</span>
      </button>
    </aside>
  );
}

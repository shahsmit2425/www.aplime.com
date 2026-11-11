export function PhoneSharingChoice({
  value,
  onChange,
  disabled,
}: {
  value?: boolean;
  disabled?: boolean;
  onChange: (share: boolean) => void;
}) {
  return (
    <fieldset className="project-phone-sharing" disabled={disabled}>
      <legend>Share your number with professionals for this project?</legend>
      <label>
        <input
          type="radio"
          name="project-phone-sharing"
          checked={value === true}
          onChange={() => onChange(true)}
        />{" "}
        Yes, matching professionals may call or text me about this project.
      </label>
      <label>
        <input
          type="radio"
          name="project-phone-sharing"
          checked={value === false}
          onChange={() => onChange(false)}
        />{" "}
        No, keep my number private. Professionals can message me in Aplime.
      </label>
    </fieldset>
  );
}

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { request } from "./api.js";
type Suggestion = { address: string; placeId: string };
export function AddressAutocomplete({
  label,
  defaultAddress = "",
  defaultPlaceId = "",
}: {
  label: string;
  defaultAddress?: string;
  defaultPlaceId?: string;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultAddress),
    [placeId, setPlaceId] = useState(defaultPlaceId);
  const [rows, setRows] = useState<Suggestion[]>([]),
    [active, setActive] = useState(-1);
  const [problem, setProblem] = useState(""),
    [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0),
    [canRetry, setCanRetry] = useState(false);
  const session = useRef(crypto.randomUUID()),
    version = useRef(0);
  useEffect(() => {
    input.current?.setCustomValidity(
      placeId ? "" : "Select a complete address from the suggestions.",
    );
  }, [placeId, value]);
  useEffect(() => {
    const current = ++version.current;
    if (placeId || value.trim().length < 3) {
      setRows([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      setProblem("");
      setCanRetry(false);
      void request<Suggestion[]>(
        "/locations/autocomplete?q=" +
          encodeURIComponent(value.trim()) +
          "&sessionToken=" +
          session.current,
      )
        .then((result) => {
          if (current === version.current) {
            setRows(result);
            setActive(-1);
            setProblem(
              result.length
                ? ""
                : "No addresses found. Add a street number and city.",
            );
          }
        })
        .catch((error) => {
          if (current === version.current) {
            setRows([]);
            setProblem(error.message);
            setCanRetry(true);
          }
        })
        .finally(() => {
          if (current === version.current) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      version.current++;
    };
  }, [value, placeId, retry]);
  async function select(row: Suggestion) {
    const current = ++version.current;
    setRows([]);
    setLoading(true);
    setProblem("");
    setCanRetry(false);
    try {
      const selected = await request<{ label: string; placeId: string }>(
        "/locations/details?placeId=" +
          encodeURIComponent(row.placeId) +
          "&sessionToken=" +
          session.current,
      );
      if (current !== version.current) return;
      setValue(selected.label);
      setPlaceId(selected.placeId);
      session.current = crypto.randomUUID();
    } catch (error) {
      if (current === version.current) {
        setProblem((error as Error).message);
        setCanRetry(true);
      }
    } finally {
      if (current === version.current) setLoading(false);
    }
  }
  return (
    <div className="address-autocomplete">
      <label htmlFor={id}>{label}</label>
      <div className="address-input">
        <MapPin size={18} aria-hidden="true" />
        <input
          ref={input}
          id={id}
          name="address"
          value={value}
          required
          minLength={5}
          maxLength={200}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={rows.length > 0}
          aria-controls={id + "-list"}
          aria-activedescendant={active >= 0 ? id + "-" + active : undefined}
          aria-describedby={id + "-status"}
          placeholder="Start with a street number and street"
          onChange={(event) => {
            version.current++;
            setValue(event.target.value);
            setPlaceId("");
            setRows([]);
            setActive(-1);
            setProblem("");
            setCanRetry(false);
            setLoading(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && rows.length) {
              event.preventDefault();
              setActive((active + 1) % rows.length);
            }
            if (event.key === "ArrowUp" && rows.length) {
              event.preventDefault();
              setActive((active + rows.length - 1) % rows.length);
            }
            if (event.key === "Escape") {
              setRows([]);
              setActive(-1);
            }
            if (event.key === "Enter" && active >= 0 && rows[active]) {
              event.preventDefault();
              void select(rows[active]);
            }
          }}
        />
      </div>
      <input type="hidden" name="placeId" value={placeId} />
      {rows.length > 0 && (
        <ul className="address-suggestions" id={id + "-list"} role="listbox">
          {rows.map((row, index) => (
            <li
              key={row.placeId}
              id={id + "-" + index}
              role="option"
              aria-selected={index === active}
            >
              <button type="button" onClick={() => void select(row)}>
                {row.address}
              </button>
            </li>
          ))}
          <li role="presentation" className="google-attribution" translate="no">
            Google Maps
          </li>
        </ul>
      )}
      <small id={id + "-status"} role="status">
        {loading
          ? "Checking address…"
          : problem ||
            (placeId
              ? "Address selected."
              : "Choose a complete US street address from Google suggestions.")}
      </small>
      {canRetry && !loading && (
        <button
          type="button"
          className="secondary"
          onClick={() => setRetry((n) => n + 1)}
        >
          Retry address search
        </button>
      )}
    </div>
  );
}

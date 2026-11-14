// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TireEditor, tireStateFromVehicle, type TireState } from "./TireEditor";

afterEach(cleanup);

function Harness({ initial }: { initial: TireState }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <TireEditor value={v} onChange={(p) => setV((x) => ({ ...x, ...p }))} mileage={90000} />
      <output data-testid="state">{JSON.stringify(v)}</output>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId("state").textContent!) as TireState;

const single = tireStateFromVehicle({ tires_separate: false, tires_replaced_at: "2035-03-01" });
const separate = tireStateFromVehicle({
  tires_separate: true,
  tire_fl_at: "2035-01-01",
  tire_fr_at: "2000-01-01",
  tire_rl_at: "2010-06-01",
  tire_rr_at: null,
});

const wheel = (name: RegExp) => screen.getByRole("button", { name });

describe("TireEditor: single date mode", () => {
  it("highlights all four wheels together and shows one date field", () => {
    render(<Harness initial={single} />);
    for (const n of [/קדמי ימני/, /קדמי שמאלי/, /אחורי ימני/, /אחורי שמאלי/]) {
      expect(wheel(n).getAttribute("aria-pressed")).toBe("true");
    }
    expect(screen.getByLabelText("תאריך החלפה (כל הגלגלים)")).toBeTruthy();
  });

  it("labels every wheel with its date and a status text, not color alone", () => {
    render(<Harness initial={single} />);
    const label = wheel(/קדמי ימני/).textContent!;
    expect(label).toContain("01/03/2035");
    expect(label).toContain("תקין");
  });

  it("copies the date to every wheel when switching to separate dates, and says so", async () => {
    const user = userEvent.setup();
    render(<Harness initial={single} />);
    await user.click(screen.getByRole("checkbox", { name: "תאריך נפרד לכל גלגל" }));
    const s = state();
    expect(s.tires_separate).toBe(true);
    expect([s.tire_fl_at, s.tire_fr_at, s.tire_rl_at, s.tire_rr_at]).toEqual(["01/03/2035", "01/03/2035", "01/03/2035", "01/03/2035"]);
    expect(screen.getByText("התאריך הועתק לכל ארבעת הגלגלים. אפשר לשנות כל גלגל בנפרד.")).toBeTruthy();
  });
});

describe("TireEditor: separate dates mode", () => {
  it("asks which wheel to edit, then shows a field titled with the wheel name", async () => {
    const user = userEvent.setup();
    render(<Harness initial={separate} />);
    expect(screen.getByText("לחצו על גלגל כדי להזין את תאריך ההחלפה שלו.")).toBeTruthy();
    await user.click(wheel(/קדמי ימני/));
    expect(screen.getByLabelText("קדמי ימני – תאריך החלפה")).toBeTruthy();
    expect(wheel(/קדמי ימני/).getAttribute("aria-pressed")).toBe("true");
    expect(wheel(/קדמי שמאלי/).getAttribute("aria-pressed")).toBe("false");
  });

  it("shows a text status per wheel: overdue, ok and not entered", () => {
    render(<Harness initial={separate} />);
    expect(wheel(/קדמי ימני/).textContent).toContain("באיחור");
    expect(wheel(/קדמי שמאלי/).textContent).toContain("תקין");
    expect(wheel(/אחורי ימני/).textContent).toContain("לא הוזן");
  });

  it("edits one wheel without touching the others", async () => {
    const user = userEvent.setup();
    render(<Harness initial={separate} />);
    await user.click(wheel(/אחורי ימני/));
    await user.type(screen.getByLabelText("אחורי ימני – תאריך החלפה"), "05052031");
    const s = state();
    expect(s.tire_rr_at).toBe("05/05/2031");
    expect(s.tire_fr_at).toBe("01/01/2000");
  });

  it("asks before merging to the oldest date, and cancel keeps the wheel dates", async () => {
    const user = userEvent.setup();
    render(<Harness initial={separate} />);
    await user.click(screen.getByRole("checkbox", { name: "תאריך נפרד לכל גלגל" }));
    expect(screen.getByText("התאריך הישן ביותר יחול על כל הגלגלים")).toBeTruthy();
    expect(state().tires_separate).toBe(true);
    await user.click(screen.getByRole("button", { name: "ביטול" }));
    expect(screen.queryByText("התאריך הישן ביותר יחול על כל הגלגלים")).toBeNull();
    expect(state().tires_separate).toBe(true);
    expect(state().tire_fr_at).toBe("01/01/2000");
  });

  it("applies the oldest date to the single field on confirm", async () => {
    const user = userEvent.setup();
    render(<Harness initial={separate} />);
    await user.click(screen.getByRole("checkbox", { name: "תאריך נפרד לכל גלגל" }));
    await user.click(screen.getByRole("button", { name: "אישור" }));
    const s = state();
    expect(s.tires_separate).toBe(false);
    expect(s.tires_replaced_at).toBe("01/01/2000");
  });

  it("switches back silently when no wheel has a date", async () => {
    const user = userEvent.setup();
    const empty = tireStateFromVehicle({ tires_separate: true });
    render(<Harness initial={empty} />);
    await user.click(screen.getByRole("checkbox", { name: "תאריך נפרד לכל גלגל" }));
    expect(screen.queryByText("התאריך הישן ביותר יחול על כל הגלגלים")).toBeNull();
    expect(state().tires_separate).toBe(false);
  });
});

describe("TireEditor: reminder settings", () => {
  it("is collapsed by default and opens when a value is set", () => {
    const { container, unmount } = render(<Harness initial={single} />);
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(false);
    unmount();
    const withKm = render(<Harness initial={{ ...single, tires_replaced_km: "60000" }} />);
    expect(withKm.container.querySelector("details")?.hasAttribute("open")).toBe(true);
  });

  it("shows field errors from the server", () => {
    render(<TireEditor value={single} onChange={() => {}} mileage={1} errors={{ tires_replaced_at: "תאריך לא תקין" }} />);
    expect(screen.getByText("תאריך לא תקין")).toBeTruthy();
  });
});

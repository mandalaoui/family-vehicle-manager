// @vitest-environment jsdom
// Structural accessibility checks with axe-core (labels, roles, names, ARIA validity, landmarks).
// jsdom has no layout, so color-contrast cannot be evaluated here; it is checked separately in a real browser.
import axe from "axe-core";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/lib/actions/vehicles", () => ({ createVehicle: vi.fn(), updateVehicle: vi.fn() }));
vi.mock("@/lib/actions/battery-tires", () => ({ updateBattery: vi.fn(), updateTires: vi.fn() }));
vi.mock("@/lib/actions/garages", () => ({ createGarage: vi.fn(), updateGarage: vi.fn(), deleteGarage: vi.fn() }));
vi.mock("@/lib/upload-photo", () => ({ uploadVehiclePhoto: vi.fn() }));

import { GarageManager } from "@/components/garages/GarageManager";
import { Status } from "@/components/ui/Status";
import { ToastProvider } from "@/components/ui/Toast";
import { BatteryEdit } from "@/components/vehicles/BatteryEdit";
import { BatteryFields, batteryStateFromVehicle } from "@/components/vehicles/BatteryFields";
import { TireEditor, tireStateFromVehicle } from "@/components/vehicles/TireEditor";
import { TiresEdit } from "@/components/vehicles/TiresEdit";
import { VehicleForm } from "@/components/vehicles/VehicleForm";

afterEach(cleanup);

async function violations(container: Element) {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

function TireHarness({ separate }: { separate: boolean }) {
  const [v, setV] = useState(
    tireStateFromVehicle({ tires_separate: separate, tires_replaced_at: "2030-01-01", tire_fl_at: "2030-01-01", tire_fr_at: "2000-01-01" }),
  );
  return <TireEditor value={v} onChange={(p) => setV((x) => ({ ...x, ...p }))} mileage={90000} />;
}

const garages = [
  { id: "g1", family_id: "f", name: "מוסך משה", phone: "03-1234567", address: "הרצל 5, חיפה", notes: "פתוח עד 17:00", created_by: null, created_at: "2026-01-01T00:00:00Z" },
];

describe("axe sanity", () => {
  it("really detects problems (an image without alt text and an unlabeled input)", async () => {
    const { container } = render(
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- deliberate violation for the sanity check */}
        <img src="x.png" />
        <input />
      </div>,
    );
    const found = await violations(container);
    expect(found.some((v) => v.startsWith("image-alt"))).toBe(true);
    expect(found.some((v) => v.startsWith("label"))).toBe(true);
  });
});

describe("axe: structure and names", () => {
  it("status chips", async () => {
    const { container } = render(
      <>
        <Status level="ok" />
        <Status level="soon" />
        <Status level="urgent" />
        <Status level="overdue" />
      </>,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("tire editor, single and separate modes", async () => {
    const a = render(<TireHarness separate={false} />);
    expect(await violations(a.container)).toEqual([]);
    a.unmount();
    const b = render(<TireHarness separate />);
    expect(await violations(b.container)).toEqual([]);
  });

  it("tire editor with a selected wheel and the merge confirmation", async () => {
    const user = userEvent.setup();
    const { container } = render(<TireHarness separate />);
    await user.click(screen.getByRole("button", { name: /קדמי ימני/ }));
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole("checkbox", { name: "תאריך נפרד לכל גלגל" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(await violations(container)).toEqual([]);
  });

  it("battery fields", async () => {
    const { container } = render(<BatteryFields value={batteryStateFromVehicle()} onChange={() => {}} errors={{ battery_notes: "שגיאה" }} />);
    expect(await violations(container)).toEqual([]);
  });

  it("vehicle form", async () => {
    const { container } = render(
      <ToastProvider>
        <VehicleForm familyId="f" />
      </ToastProvider>,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("garage list and its add dialog", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <GarageManager garages={garages} isAdmin />
      </ToastProvider>,
    );
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "הוספת מוסך" }));
    await screen.findByRole("dialog");
    expect(await violations(document.body)).toEqual([]);
  });

  it("battery and tires edit dialogs", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <BatteryEdit vehicle={{ id: "v", battery_replaced_at: null, battery_warranty_until: null, battery_notes: null, battery_reminder_months: 36 }} />
        <TiresEdit
          vehicle={{
            id: "v",
            mileage: 1,
            tires_separate: false,
            tires_replaced_at: null,
            tire_fl_at: null,
            tire_fr_at: null,
            tire_rl_at: null,
            tire_rr_at: null,
            tires_replaced_km: null,
            tires_reminder_months: 48,
            tires_reminder_km: 50000,
          }}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "עריכת פרטי המצבר" }));
    await screen.findByRole("dialog");
    expect(await violations(document.body)).toEqual([]);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "עריכת פרטי הצמיגים" }));
    await screen.findByRole("dialog");
    expect(await violations(document.body)).toEqual([]);
    expect(container).toBeTruthy();
  });
});

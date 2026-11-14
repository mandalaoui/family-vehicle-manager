// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateBattery = vi.fn();
const updateTires = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn() }) }));
vi.mock("@/lib/actions/battery-tires", () => ({
  updateBattery: (...a: unknown[]) => updateBattery(...a),
  updateTires: (...a: unknown[]) => updateTires(...a),
}));

import { ToastProvider } from "@/components/ui/Toast";
import { BatteryEdit } from "./BatteryEdit";
import { TiresEdit } from "./TiresEdit";

const battery = {
  id: "veh-1",
  battery_replaced_at: "2024-01-01",
  battery_warranty_until: null,
  battery_notes: null,
  battery_reminder_months: 36,
};
const tires = {
  id: "veh-1",
  mileage: 90000,
  tires_separate: false,
  tires_replaced_at: "2024-01-01",
  tire_fl_at: null,
  tire_fr_at: null,
  tire_rl_at: null,
  tire_rr_at: null,
  tires_replaced_km: null,
  tires_reminder_months: 48,
  tires_reminder_km: 50000,
};

beforeEach(() => {
  updateBattery.mockReset();
  updateTires.mockReset();
  refresh.mockReset();
});
afterEach(cleanup);

describe("battery quick edit", () => {
  it("opens a focused modal (lazy loaded) and saves through the dedicated action", async () => {
    updateBattery.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <BatteryEdit vehicle={battery} />
      </ToastProvider>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "עריכת פרטי המצבר" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("עריכת מצבר");
    expect(dialog.textContent).not.toContain("תאריך נפרד לכל גלגל");
    await user.click(screen.getByRole("button", { name: "שמירה" }));
    await waitFor(() => expect(updateBattery).toHaveBeenCalledTimes(1));
    expect(updateBattery.mock.calls[0][0]).toBe("veh-1");
    expect(updateBattery.mock.calls[0][1]).toMatchObject({ battery_replaced_at: "01/01/2024", battery_reminder_months: "36" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the modal open and shows the field error when the server rejects", async () => {
    updateBattery.mockResolvedValue({ ok: false, error: "x", fieldErrors: { battery_replaced_at: "התאריך לא יכול להיות בעתיד" } });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <BatteryEdit vehicle={battery} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "עריכת פרטי המצבר" }));
    await user.click(await screen.findByRole("button", { name: "שמירה" }));
    expect(await screen.findByText("התאריך לא יכול להיות בעתיד")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <BatteryEdit vehicle={battery} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "עריכת פרטי המצבר" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("tires quick edit", () => {
  it("opens the tire editor and saves the form values through updateTires", async () => {
    updateTires.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TiresEdit vehicle={tires} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "עריכת פרטי הצמיגים" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("חזית");
    expect(dialog.textContent).toContain("תאריך נפרד לכל גלגל");
    await user.click(screen.getByRole("button", { name: "שמירה" }));
    await waitFor(() => expect(updateTires).toHaveBeenCalledTimes(1));
    expect(updateTires.mock.calls[0][1]).toMatchObject({ tires_separate: false, tires_replaced_at: "01/01/2024", tires_reminder_months: "48" });
  });
});

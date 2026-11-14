// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createVehicle = vi.fn();
const updateVehicle = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/actions/vehicles", () => ({
  createVehicle: (...a: unknown[]) => createVehicle(...a),
  updateVehicle: (...a: unknown[]) => updateVehicle(...a),
}));
vi.mock("@/lib/upload-photo", () => ({ uploadVehiclePhoto: vi.fn() }));

import { ToastProvider } from "@/components/ui/Toast";
import { VehicleForm } from "./VehicleForm";

const renderForm = () =>
  render(
    <ToastProvider>
      <VehicleForm familyId="fam-1" />
    </ToastProvider>,
  );

beforeEach(() => {
  createVehicle.mockReset();
  updateVehicle.mockReset();
  push.mockReset();
});
afterEach(cleanup);

describe("VehicleForm", () => {
  it("shows no errors before a submit attempt", () => {
    renderForm();
    expect(screen.queryByText("הזינו יצרן")).toBeNull();
    expect(screen.queryByText("הזינו את הקילומטראז׳ הנוכחי")).toBeNull();
  });

  it("sends defaults for battery, tires and service interval", async () => {
    createVehicle.mockResolvedValue({ ok: false, error: "x", fieldErrors: { make: "הזינו יצרן" } });
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "שמירת רכב" }));
    await waitFor(() => expect(createVehicle).toHaveBeenCalledTimes(1));
    expect(createVehicle.mock.calls[0][0]).toMatchObject({
      service_interval_km: "10000",
      battery_reminder_months: "36",
      tires_separate: false,
      tires_reminder_months: "48",
      tires_reminder_km: "50000",
    });
  });

  it("shows field errors only after submit and clears an error when the field is edited", async () => {
    createVehicle.mockResolvedValue({
      ok: false,
      error: "יש לתקן את השדות המסומנים.",
      fieldErrors: { make: "הזינו יצרן", mileage: "הזינו את הקילומטראז׳ הנוכחי" },
    });
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "שמירת רכב" }));
    expect(await screen.findByText("הזינו יצרן")).toBeTruthy();
    expect(screen.getByText("הזינו את הקילומטראז׳ הנוכחי")).toBeTruthy();

    await user.type(screen.getByLabelText("יצרן"), "קיה");
    expect(screen.queryByText("הזינו יצרן")).toBeNull();
    // The other error stays until that field is touched.
    expect(screen.getByText("הזינו את הקילומטראז׳ הנוכחי")).toBeTruthy();
  });

  it("keeps battery and tires as two separate collapsible sections", () => {
    const { container } = renderForm();
    const titles = [...container.querySelectorAll("details > summary")].map((s) => s.textContent ?? "");
    expect(titles.some((t) => t.includes("מצבר"))).toBe(true);
    expect(titles.some((t) => t.includes("צמיגים"))).toBe(true);
    const batteryDetails = [...container.querySelectorAll("details")].find((d) => d.textContent?.includes("תאריך החלפת מצבר"));
    expect(batteryDetails?.textContent?.includes("תאריך נפרד לכל גלגל")).toBe(false);
  });

  it("navigates to the new vehicle after a successful save", async () => {
    createVehicle.mockResolvedValue({ ok: true, id: "veh-1" });
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "שמירת רכב" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/vehicles/veh-1"));
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/context", () => ({
  getFamilyContext: async () => ({ membership: { familyName: "משפחת בדיקה" } }),
}));
vi.mock("@/components/AppHeader", () => ({ AppHeader: () => <header>header</header> }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

import AppLayout from "@/app/(app)/layout";
import { SiteShell } from "@/components/SiteShell";

function expectFooter() {
  expect(screen.getByRole("link", { name: "מדיניות פרטיות" }).getAttribute("href")).toBe("/privacy");
  expect(screen.getByRole("link", { name: "תנאי שימוש" }).getAttribute("href")).toBe("/terms");
  expect(screen.getByText(/© 2026 ניהול רכבי המשפחה/)).toBeTruthy();
  expect(screen.getByRole("contentinfo")).toBeTruthy();
}

afterEach(cleanup);

describe("site footer", () => {
  it("renders on public pages (login, invite, privacy, terms)", () => {
    render(
      <SiteShell>
        <main>תוכן ציבורי</main>
      </SiteShell>,
    );
    expect(screen.getByText("תוכן ציבורי")).toBeTruthy();
    expectFooter();
  });

  it("renders under the logged-in app layout", async () => {
    const layout = await AppLayout({ children: <p>תוכן האפליקציה</p> });
    render(<SiteShell>{layout}</SiteShell>);
    expect(screen.getByText("תוכן האפליקציה")).toBeTruthy();
    expectFooter();
  });

  it("has tap targets of at least 44px (min-h-11)", () => {
    render(<SiteShell>x</SiteShell>);
    for (const name of ["מדיניות פרטיות", "תנאי שימוש"]) {
      expect(screen.getByRole("link", { name }).className).toContain("min-h-11");
    }
  });
});

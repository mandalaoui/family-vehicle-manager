import { Shield } from "lucide-react";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState, ScreenHeader } from "@/components/ui/Layout";
import { requireMembership } from "@/lib/server/context";

export const metadata = { title: "הוספת רכב · ניהול רכבי המשפחה" };

export default async function NewVehiclePage() {
  const ctx = await requireMembership();
  const isAdmin = ctx.membership.role === "admin";
  const familyId = ctx.membership.familyId;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md pt-6">
        <EmptyState icon={Shield} title="הפעולה הזאת פתוחה למנהלי המשפחה בלבד">
          כדי להוסיף רכב, בקשו ממנהל המשפחה.
        </EmptyState>
        <div className="mt-4 flex justify-center">
          <LinkButton href="/" variant="neutral">
            חזרה לרכבים
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <>
      <ScreenHeader title="הוספת רכב" subtitle="הזינו את פרטי הרכב. אפשר לעדכן אותם בכל שלב." backHref="/" />
      <VehicleForm familyId={familyId} />
    </>
  );
}

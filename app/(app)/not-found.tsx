import { Car } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Layout";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-6">
      <EmptyState icon={Car} title="הדף או הרכב לא נמצאו">
        ייתכן שהרכב נמחק, או שאין לכם גישה אליו.
      </EmptyState>
      <div className="mt-4 flex justify-center">
        <LinkButton href="/" variant="neutral">
          חזרה לרכבים
        </LinkButton>
      </div>
    </div>
  );
}

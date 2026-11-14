import { Row } from "@/components/ui/Layout";
import { Ltr } from "@/components/ui/Plate";
import { formatDate } from "@/lib/format";
import { fetchMinistryVehicle } from "@/lib/server/ministry";

// Information only ("טסט אחרון"), read from the Ministry dataset (cached for a day).
// Renders nothing if the service is slow or has no record.
export async function LastTestInfo({ plate }: { plate: string }) {
  const result = await fetchMinistryVehicle(plate);
  if (result.status !== "ok" || !result.vehicle.last_test) return null;
  return (
    <Row label="טסט אחרון (משרד התחבורה)">
      <Ltr>{formatDate(result.vehicle.last_test)}</Ltr>
    </Row>
  );
}

export const PHOTO_BUCKET = "vehicle-photos";

/** Storage object name: {family_id}/{vehicle_id}.jpg (enforced by the storage RLS policies). */
export const photoPath = (familyId: string, vehicleId: string) => `${familyId}/${vehicleId}.jpg`;

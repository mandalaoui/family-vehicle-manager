import { Info, Pencil, UserPlus, Users } from "lucide-react";
import { InvitePanel, type InviteView } from "@/components/settings/InvitePanel";
import { MembersList, type MemberView } from "@/components/settings/MembersList";
import { RenameFamily } from "@/components/settings/RenameFamily";
import { Notice, ScreenHeader, Section } from "@/components/ui/Layout";
import { inviteDisplayStatus } from "@/lib/invites";
import { requireMembership } from "@/lib/server/context";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "הגדרות משפחה · ניהול רכבי המשפחה" };

export default async function SettingsPage() {
  const ctx = await requireMembership();
  const { familyId, familyName, role } = ctx.membership;
  const userId = ctx.user.id;
  const isAdmin = role === "admin";
  const supabase = await createClient();

  const { data: memberRows } = await supabase
    .from("family_members")
    .select("user_id, role, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });
  const ids = (memberRows ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  const members: MemberView[] = (memberRows ?? []).map((m) => {
    const p = byId.get(m.user_id);
    return {
      userId: m.user_id,
      name: p?.full_name?.trim() || p?.email || "חבר משפחה",
      email: p?.email ?? null,
      role: m.role,
      isYou: m.user_id === userId,
    };
  });

  let invites: InviteView[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("invitations")
      .select("id, email, role, token, status, expires_at")
      .eq("family_id", familyId)
      .in("status", ["pending", "expired"])
      .order("created_at", { ascending: false });
    invites = (data ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      token: i.token,
      status: inviteDisplayStatus(i.status, i.expires_at),
      expiresAt: i.expires_at,
    }));
  }

  return (
    <>
      <ScreenHeader title="הגדרות משפחה" subtitle={familyName} />
      {!isAdmin ? (
        <div className="mb-4">
          <Notice icon={Info}>מצב צפייה בלבד. רק מנהל יכול להזמין, להסיר, לשנות תפקידים ולשנות את שם המשפחה.</Notice>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={Users} title="חברי המשפחה" className="lg:col-span-2">
          <MembersList members={members} isAdmin={isAdmin} />
        </Section>

        {isAdmin ? (
          <>
            <Section icon={UserPlus} title="הזמנת בן משפחה">
              <InvitePanel invites={invites} />
            </Section>
            <Section icon={Pencil} title="פרטי המשפחה">
              <RenameFamily name={familyName} />
            </Section>
          </>
        ) : null}
      </div>
    </>
  );
}

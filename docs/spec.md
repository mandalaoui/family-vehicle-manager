# Original task spec (written by the user; kept verbatim)

You are working in my repo family-vehicle-manager. index.html is an approved clickable prototype (Hebrew RTL, mock data). Goal: Phase 1 of the real app. Keep the same look, screens and UX as index.html (use it as the design reference; move it to /prototype or docs/ rather than deleting it).

## Stack
Next.js (App Router, TypeScript), Tailwind, Supabase (@supabase/supabase-js + @supabase/ssr), deploy target Vercel. Free tiers only. No shadcn.

## Supabase connection (follow official Supabase Next.js App Router pattern)
- Supabase project already exists (ref: rtaixfnwuievkvyosrsp).
- Env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. I will create .env.local myself — never ask me to paste keys into chat and never hardcode them. Create .env.example with placeholders and make sure .env* (except .env.example) is in .gitignore.
- Create utils/supabase/server.ts (createServerClient with cookies getAll/setAll), utils/supabase/client.ts (createBrowserClient), utils/supabase/middleware.ts + root middleware.ts that refreshes the session on every request (call supabase.auth.getUser()) and redirects unauthenticated users to /login, excluding /login, /auth/callback, /invite/* and static assets.
- Auth route /auth/callback that exchanges the OAuth code for a session.
- Use getUser() (not getSession()) for any server-side authorization.
- Optional: you may run `npx skills add supabase/agent-skills` if it helps you, after telling me what it installs.

## Phase 1 scope
1. Auth: Sign in with Google via Supabase Auth. Protected routes. Profile row created on first login (DB trigger on auth.users).
2. Data model (SQL migration in supabase/migrations):
   - profiles(id = auth.users.id, full_name, email, created_at)
   - families(id, name, created_by, created_at)
   - family_members(family_id, user_id, role: 'admin'|'member', created_at) — unique (family_id, user_id)
   - invitations(id, family_id, email, role, token unique, status: 'pending'|'accepted'|'revoked'|'expired', expires_at, created_by)
   - vehicles(id, family_id, plate, make, model, year, color, mileage, test_due, license_due, insurance_due, next_service_km, notes, created_at, updated_at)
   - Proper FKs with ON DELETE behavior, indexes on family_id, plate unique per family.
3. RLS enabled on every table: a user can only read/write rows of families they belong to; only admins can invite, change roles or delete vehicles; block removing/demoting the last admin (enforce in DB with a trigger, not only UI). Use SECURITY DEFINER helper functions (e.g. is_family_member, is_family_admin) to avoid recursive RLS policies. Accepting an invite must go through a secure RPC function that validates token, status and expiry.
4. Screens: login, onboarding (create family or accept invite), dashboard with alerts computed from dates/mileage (overdue / within 30 days / within 7 days), vehicles list, add/edit vehicle (manual entry only), vehicle details with "update mileage" and "service done", family settings (members, roles, invite by link, revoke invite).
5. Invitations: admin creates invite → copyable link /invite/[token]; user logs in with Google and joins. No emails yet.
6. Mutations through Server Actions with zod validation and clear Hebrew error messages. Hebrew RTL (dir="rtl" on <html>), Israeli date format (dd/mm/yyyy), Israeli plate format, mobile-first, loading and empty states.

## Out of scope for now
data.gov.il plate lookup, garages / Google Places, email reminders, cron.

## Security
- The repo is PUBLIC: never commit secrets.
- Never use or request the service_role key; everything must work with the publishable key + RLS.
- Don't trust client input for family_id/role — derive permissions from the DB.

## Process
1. First show me a short plan, the folder structure, and the full SQL (schema + RLS + triggers + RPC functions). Wait for my approval.
2. For applying the schema: give me the migration SQL to run in the Supabase SQL Editor (or use Supabase CLI with `supabase link` only if I approve).
3. Implement in small, logical commits. Run `npm run build` and lint before each commit and fix errors.
4. At the end give me:
   - Step-by-step setup: Google Cloud OAuth client (consent screen, authorized redirect URI = https://rtaixfnwuievkvyosrsp.supabase.co/auth/v1/callback), Supabase Google provider, Supabase URL Configuration (Site URL + Redirect URLs for http://localhost:3000/** and the future Vercel domain).
   - Vercel deploy steps (import repo, env vars, then update redirect URLs).
   - A manual test checklist, including RLS tests with two different Google users (user B must not see family A's data, member can't delete vehicles, last admin can't be removed, expired/revoked invite fails).
   - An updated README.

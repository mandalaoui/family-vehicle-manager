// Hand-written to match supabase/migrations. Keep in sync when the schema changes.
export type Role = "admin" | "member";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type FuelType = "petrol" | "diesel" | "hybrid" | "plug_in" | "electric";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; email: string | null; created_at: string };
        Insert: { id: string; full_name?: string | null; email?: string | null; created_at?: string };
        Update: { full_name?: string | null };
        Relationships: [];
      };
      families: {
        Row: { id: string; name: string; created_by: string | null; created_at: string };
        Insert: { id?: string; name: string; created_by?: string | null; created_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      family_members: {
        Row: { family_id: string; user_id: string; role: Role; created_at: string };
        Insert: { family_id: string; user_id: string; role?: Role; created_at?: string };
        Update: { role?: Role };
        Relationships: [
          {
            foreignKeyName: "family_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_members_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          id: string;
          family_id: string;
          email: string;
          role: Role;
          token: string;
          status: InvitationStatus;
          expires_at: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          family_id: string;
          plate: string;
          nickname: string | null;
          make: string;
          model: string;
          year: number | null;
          color: string | null;
          fuel_type: FuelType | null;
          mileage: number;
          mileage_updated_at: string;
          test_due: string | null;
          license_due: string | null;
          insurance_due: string | null;
          next_service_km: number | null;
          service_interval_km: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          plate: string;
          nickname?: string | null;
          make: string;
          model: string;
          year?: number | null;
          color?: string | null;
          fuel_type?: FuelType | null;
          mileage?: number;
          mileage_updated_at?: string;
          test_due?: string | null;
          license_due?: string | null;
          insurance_due?: string | null;
          next_service_km?: number | null;
          service_interval_km?: number;
          notes?: string | null;
        };
        Update: {
          plate?: string;
          nickname?: string | null;
          make?: string;
          model?: string;
          year?: number | null;
          color?: string | null;
          fuel_type?: FuelType | null;
          mileage?: number;
          mileage_updated_at?: string;
          test_due?: string | null;
          license_due?: string | null;
          insurance_due?: string | null;
          next_service_km?: number | null;
          service_interval_km?: number;
          notes?: string | null;
        };
        Relationships: [];
      };
      service_logs: {
        Row: {
          id: string;
          vehicle_id: string;
          service_date: string;
          mileage: number;
          garage: string | null;
          cost: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          service_date: string;
          mileage: number;
          garage?: string | null;
          cost?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          service_date?: string;
          mileage?: number;
          garage?: string | null;
          cost?: number | null;
          notes?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_family: { Args: { p_name: string }; Returns: string };
      create_invitation: { Args: { p_family_id: string; p_email: string; p_role?: string }; Returns: string };
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: undefined };
      accept_invitation: { Args: { p_token: string }; Returns: string };
      get_invitation_preview: {
        Args: { p_token: string };
        Returns: { family_name: string; role: Role; status: InvitationStatus; email_matches: boolean | null }[];
      };
      recompute_next_service: { Args: { p_vehicle_id: string }; Returns: undefined };
      complete_service: {
        Args: {
          p_vehicle_id: string;
          p_date: string;
          p_mileage: number;
          p_garage: string | null;
          p_cost: number | null;
          p_notes: string | null;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type ServiceLog = Database["public"]["Tables"]["service_logs"]["Row"];
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];

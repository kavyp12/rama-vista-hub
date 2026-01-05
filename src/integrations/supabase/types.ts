export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          agent_id: string
          call_date: string
          call_duration: number | null
          call_status: Database["public"]["Enums"]["call_status"]
          callback_scheduled_at: string | null
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          recording_url: string | null
          rejection_reason: string | null
          retry_count: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          call_date?: string
          call_duration?: number | null
          call_status: Database["public"]["Enums"]["call_status"]
          callback_scheduled_at?: string | null
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          recording_url?: string | null
          rejection_reason?: string | null
          retry_count?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          call_date?: string
          call_duration?: number | null
          call_status?: Database["public"]["Enums"]["call_status"]
          callback_scheduled_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          recording_url?: string | null
          rejection_reason?: string | null
          retry_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          deal_value: number
          expected_close_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          probability: number | null
          project_id: string | null
          property_id: string | null
          stage: string | null
          token_amount: number | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          deal_value: number
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          probability?: number | null
          project_id?: string | null
          property_id?: string | null
          stage?: string | null
          token_amount?: number | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          deal_value?: number
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          probability?: number | null
          project_id?: string | null
          property_id?: string | null
          stage?: string | null
          token_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          file_url: string | null
          id: string
          lead_id: string | null
          name: string
          project_id: string | null
          property_id: string | null
          signed_at: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_url?: string | null
          id?: string
          lead_id?: string | null
          name: string
          project_id?: string | null
          property_id?: string | null
          signed_at?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_url?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          project_id?: string | null
          property_id?: string | null
          signed_at?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_tasks: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          related_call_id: string | null
          scheduled_at: string
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          related_call_id?: string | null
          scheduled_at: string
          status?: string
          task_type?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          related_call_id?: string | null
          scheduled_at?: string
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_tasks_related_call_id_fkey"
            columns: ["related_call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          budget_max: number | null
          budget_min: number | null
          campaign: string | null
          created_at: string
          email: string | null
          id: string
          interested_project_id: string | null
          interested_property_id: string | null
          last_contacted_at: string | null
          name: string
          next_followup_at: string | null
          notes: string | null
          phone: string
          preferred_location: string | null
          preferred_property_type:
            | Database["public"]["Enums"]["property_type"]
            | null
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          temperature: Database["public"]["Enums"]["lead_temperature"] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          campaign?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interested_project_id?: string | null
          interested_property_id?: string | null
          last_contacted_at?: string | null
          name: string
          next_followup_at?: string | null
          notes?: string | null
          phone: string
          preferred_location?: string | null
          preferred_property_type?:
            | Database["public"]["Enums"]["property_type"]
            | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          temperature?: Database["public"]["Enums"]["lead_temperature"] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          campaign?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interested_project_id?: string | null
          interested_property_id?: string | null
          last_contacted_at?: string | null
          name?: string
          next_followup_at?: string | null
          notes?: string | null
          phone?: string
          preferred_location?: string | null
          preferred_property_type?:
            | Database["public"]["Enums"]["property_type"]
            | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          temperature?: Database["public"]["Enums"]["lead_temperature"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_interested_project_id_fkey"
            columns: ["interested_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interested_property_id_fkey"
            columns: ["interested_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          clicked_count: number | null
          converted_count: number | null
          created_at: string
          created_by: string | null
          id: string
          message_template: string | null
          name: string
          opened_count: number | null
          scheduled_at: string | null
          sent_count: number | null
          status: string
          target_audience: string | null
          type: string
          updated_at: string
        }
        Insert: {
          clicked_count?: number | null
          converted_count?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          message_template?: string | null
          name: string
          opened_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          target_audience?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          clicked_count?: number | null
          converted_count?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          message_template?: string | null
          name?: string
          opened_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          target_audience?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          deal_id: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_type: string
          property_id: string | null
          reference_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          deal_id?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_type?: string
          property_id?: string | null
          reference_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deal_id?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_type?: string
          property_id?: string | null
          reference_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          amenities: string[] | null
          available_units: number | null
          brochure_url: string | null
          city: string | null
          created_at: string
          description: string | null
          developer: string | null
          id: string
          images: string[] | null
          location: string
          max_price: number | null
          min_price: number | null
          name: string
          status: string | null
          total_units: number | null
          updated_at: string
        }
        Insert: {
          amenities?: string[] | null
          available_units?: number | null
          brochure_url?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          developer?: string | null
          id?: string
          images?: string[] | null
          location: string
          max_price?: number | null
          min_price?: number | null
          name: string
          status?: string | null
          total_units?: number | null
          updated_at?: string
        }
        Update: {
          amenities?: string[] | null
          available_units?: number | null
          brochure_url?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          developer?: string | null
          id?: string
          images?: string[] | null
          location?: string
          max_price?: number | null
          min_price?: number | null
          name?: string
          status?: string | null
          total_units?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          area_sqft: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          created_at: string
          description: string | null
          features: string[] | null
          floor_plan_url: string | null
          id: string
          images: string[] | null
          location: string
          price: number
          project_id: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          status: Database["public"]["Enums"]["property_status"]
          title: string
          updated_at: string
        }
        Insert: {
          area_sqft?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          features?: string[] | null
          floor_plan_url?: string | null
          id?: string
          images?: string[] | null
          location: string
          price: number
          project_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          updated_at?: string
        }
        Update: {
          area_sqft?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          features?: string[] | null
          floor_plan_url?: string | null
          id?: string
          images?: string[] | null
          location?: string
          price?: number
          project_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          conducted_by: string | null
          created_at: string
          feedback: string | null
          id: string
          lead_id: string
          project_id: string | null
          property_id: string | null
          rating: number | null
          scheduled_at: string
          status: string | null
          updated_at: string
        }
        Insert: {
          conducted_by?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          lead_id: string
          project_id?: string | null
          property_id?: string | null
          rating?: number | null
          scheduled_at: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          conducted_by?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          lead_id?: string
          project_id?: string | null
          property_id?: string | null
          rating?: number | null
          scheduled_at?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "sales_manager" | "sales_agent"
      call_status:
        | "connected_positive"
        | "connected_callback"
        | "not_connected"
        | "not_interested"
      lead_stage:
        | "new"
        | "contacted"
        | "site_visit"
        | "negotiation"
        | "token"
        | "closed"
      lead_temperature: "hot" | "warm" | "cold"
      property_status: "available" | "booked" | "sold"
      property_type:
        | "apartment"
        | "villa"
        | "plot"
        | "commercial"
        | "penthouse"
        | "townhouse"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "sales_manager", "sales_agent"],
      call_status: [
        "connected_positive",
        "connected_callback",
        "not_connected",
        "not_interested",
      ],
      lead_stage: [
        "new",
        "contacted",
        "site_visit",
        "negotiation",
        "token",
        "closed",
      ],
      lead_temperature: ["hot", "warm", "cold"],
      property_status: ["available", "booked", "sold"],
      property_type: [
        "apartment",
        "villa",
        "plot",
        "commercial",
        "penthouse",
        "townhouse",
      ],
    },
  },
} as const

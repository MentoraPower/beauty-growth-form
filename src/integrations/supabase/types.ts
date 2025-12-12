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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      crm_origins: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      crm_sub_origins: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          origin_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          origin_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          origin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sub_origins_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          created_at: string
          delay_minutes: number
          from_email: string
          from_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delay_minutes?: number
          from_email?: string
          from_name?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delay_minutes?: number
          from_email?: string
          from_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          concluida: boolean
          created_at: string
          data: string
          hora: string
          id: string
          lead_id: string
          notas: string | null
          pipeline_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          concluida?: boolean
          created_at?: string
          data: string
          hora?: string
          id?: string
          lead_id: string
          notas?: string | null
          pipeline_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          concluida?: boolean
          created_at?: string
          data?: string
          hora?: string
          id?: string
          lead_id?: string
          notas?: string | null
          pipeline_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          lead_id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          lead_id: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          lead_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tracking: {
        Row: {
          created_at: string
          dados: Json | null
          descricao: string | null
          id: string
          lead_id: string
          origem: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          lead_id: string
          origem?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          lead_id?: string
          origem?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tracking_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_analysis: string | null
          analysis_created_at: string | null
          average_ticket: number | null
          can_afford: string | null
          clinic_name: string | null
          country_code: string
          created_at: string
          email: string
          estimated_revenue: number | null
          id: string
          instagram: string
          is_mql: boolean | null
          monthly_billing: string
          name: string
          ordem: number | null
          pipeline_id: string | null
          service_area: string
          sub_origin_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          wants_more_info: boolean | null
          weekly_attendance: string
          whatsapp: string
          workspace_type: string
          years_experience: string
        }
        Insert: {
          ai_analysis?: string | null
          analysis_created_at?: string | null
          average_ticket?: number | null
          can_afford?: string | null
          clinic_name?: string | null
          country_code?: string
          created_at?: string
          email: string
          estimated_revenue?: number | null
          id?: string
          instagram: string
          is_mql?: boolean | null
          monthly_billing: string
          name: string
          ordem?: number | null
          pipeline_id?: string | null
          service_area: string
          sub_origin_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wants_more_info?: boolean | null
          weekly_attendance: string
          whatsapp: string
          workspace_type: string
          years_experience: string
        }
        Update: {
          ai_analysis?: string | null
          analysis_created_at?: string | null
          average_ticket?: number | null
          can_afford?: string | null
          clinic_name?: string | null
          country_code?: string
          created_at?: string
          email?: string
          estimated_revenue?: number | null
          id?: string
          instagram?: string
          is_mql?: boolean | null
          monthly_billing?: string
          name?: string
          ordem?: number | null
          pipeline_id?: string | null
          service_area?: string
          sub_origin_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wants_more_info?: boolean | null
          weekly_attendance?: string
          whatsapp?: string
          workspace_type?: string
          years_experience?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          page_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_path?: string
        }
        Update: {
          created_at?: string
          id?: string
          page_path?: string
        }
        Relationships: []
      }
      pipeline_automations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          pipeline_id: string
          sub_origin_id: string | null
          target_origin_id: string | null
          target_pipeline_id: string | null
          target_sub_origin_id: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id: string
          sub_origin_id?: string | null
          target_origin_id?: string | null
          target_pipeline_id?: string | null
          target_sub_origin_id?: string | null
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id?: string
          sub_origin_id?: string | null
          target_origin_id?: string | null
          target_pipeline_id?: string | null
          target_sub_origin_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_automations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_target_origin_id_fkey"
            columns: ["target_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_target_sub_origin_id_fkey"
            columns: ["target_sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
          sub_origin_id: string | null
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          sub_origin_id?: string | null
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          sub_origin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount: number
          created_at: string
          customer_name: string | null
          description: string | null
          id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_name?: string | null
          description?: string | null
          id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      sent_emails: {
        Row: {
          body_html: string
          created_at: string
          error_message: string | null
          id: string
          lead_email: string
          lead_id: string | null
          lead_name: string
          resend_id: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          body_html: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_email: string
          lead_id?: string | null
          lead_name: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          body_html?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_email?: string
          lead_id?: string | null
          lead_name?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chats: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_time: string | null
          name: string | null
          phone: string
          photo_url: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          name?: string | null
          phone: string
          photo_url?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          name?: string | null
          phone?: string
          photo_url?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          chat_id: string | null
          created_at: string
          from_me: boolean | null
          id: string
          media_type: string | null
          media_url: string | null
          message_id: string | null
          phone: string
          status: string | null
          text: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          from_me?: boolean | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          phone: string
          status?: string | null
          text?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          from_me?: boolean | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          phone?: string
          status?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_chats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

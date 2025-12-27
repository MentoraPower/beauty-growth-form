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
      calendar_appointments: {
        Row: {
          closer_name: string | null
          created_at: string
          description: string | null
          email: string | null
          end_time: string
          id: string
          is_locked: boolean | null
          is_noshow: boolean | null
          is_paid: boolean | null
          payment_value: number | null
          sdr_name: string | null
          start_time: string
          sub_origin_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closer_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          end_time: string
          id?: string
          is_locked?: boolean | null
          is_noshow?: boolean | null
          is_paid?: boolean | null
          payment_value?: number | null
          sdr_name?: string | null
          start_time: string
          sub_origin_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          closer_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          end_time?: string
          id?: string
          is_locked?: boolean | null
          is_noshow?: boolean | null
          is_paid?: boolean | null
          payment_value?: number | null
          sdr_name?: string | null
          start_time?: string
          sub_origin_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_appointments_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
        ]
      }
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
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          origin_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          origin_id?: string
          tipo?: string
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
      crm_webhooks: {
        Row: {
          auto_tag_color: string | null
          auto_tag_name: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          origin_id: string | null
          scope: string
          sub_origin_id: string | null
          trigger: string | null
          trigger_pipeline_id: string | null
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          auto_tag_color?: string | null
          auto_tag_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          origin_id?: string | null
          scope?: string
          sub_origin_id?: string | null
          trigger?: string | null
          trigger_pipeline_id?: string | null
          type: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          auto_tag_color?: string | null
          auto_tag_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          origin_id?: string | null
          scope?: string
          sub_origin_id?: string | null
          trigger?: string | null
          trigger_pipeline_id?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_webhooks_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_webhooks_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_webhooks_trigger_pipeline_id_fkey"
            columns: ["trigger_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
          widgets: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: string
          updated_at?: string
          widgets?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
          widgets?: Json | null
        }
        Relationships: []
      }
      dispatch_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_lead_name: string | null
          error_log: Json | null
          failed_count: number
          id: string
          interval_seconds: number
          message_template: string | null
          origin_name: string | null
          sent_count: number
          started_at: string | null
          status: string
          sub_origin_id: string
          sub_origin_name: string | null
          total_leads: number
          type: string
          updated_at: string
          valid_leads: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_lead_name?: string | null
          error_log?: Json | null
          failed_count?: number
          id?: string
          interval_seconds?: number
          message_template?: string | null
          origin_name?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          sub_origin_id: string
          sub_origin_name?: string | null
          total_leads?: number
          type: string
          updated_at?: string
          valid_leads?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_lead_name?: string | null
          error_log?: Json | null
          failed_count?: number
          id?: string
          interval_seconds?: number
          message_template?: string | null
          origin_name?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          sub_origin_id?: string
          sub_origin_name?: string | null
          total_leads?: number
          type?: string
          updated_at?: string
          valid_leads?: number
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_jobs_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          body_html: string
          created_at: string | null
          flow_steps: Json | null
          id: string
          is_active: boolean | null
          name: string
          sub_origin_id: string | null
          subject: string
          trigger_pipeline_id: string | null
        }
        Insert: {
          body_html: string
          created_at?: string | null
          flow_steps?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          sub_origin_id?: string | null
          subject: string
          trigger_pipeline_id?: string | null
        }
        Update: {
          body_html?: string
          created_at?: string | null
          flow_steps?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          sub_origin_id?: string | null
          subject?: string
          trigger_pipeline_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automations_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automations_trigger_pipeline_id_fkey"
            columns: ["trigger_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
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
      email_tracking_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          link_url: string | null
          scheduled_email_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          scheduled_email_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          scheduled_email_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_events_scheduled_email_id_fkey"
            columns: ["scheduled_email_id"]
            isOneToOne: false
            referencedRelation: "scheduled_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_ads_connections: {
        Row: {
          access_token: string
          access_token_expires_at: string | null
          ad_account_id: string
          ad_account_name: string | null
          created_at: string
          id: string
          is_active: boolean
          selected_campaigns: Json | null
          selected_metrics: Json | null
          updated_at: string
        }
        Insert: {
          access_token: string
          access_token_expires_at?: string | null
          ad_account_id: string
          ad_account_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          selected_campaigns?: Json | null
          selected_metrics?: Json | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string | null
          ad_account_id?: string
          ad_account_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          selected_campaigns?: Json | null
          selected_metrics?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      facebook_ads_insights: {
        Row: {
          campaign_id: string
          campaign_name: string | null
          clicks: number | null
          connection_id: string
          cpc: number | null
          cpm: number | null
          created_at: string
          date_preset: string | null
          fetched_at: string
          id: string
          impressions: number | null
          spend: number | null
        }
        Insert: {
          campaign_id: string
          campaign_name?: string | null
          clicks?: number | null
          connection_id: string
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          date_preset?: string | null
          fetched_at?: string
          id?: string
          impressions?: number | null
          spend?: number | null
        }
        Update: {
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number | null
          connection_id?: string
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          date_preset?: string | null
          fetched_at?: string
          id?: string
          impressions?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facebook_ads_insights_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "facebook_ads_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_chats: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_message: string | null
          last_message_time: string | null
          participant_avatar: string | null
          participant_id: string
          participant_name: string | null
          participant_username: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          participant_avatar?: string | null
          participant_id: string
          participant_name?: string | null
          participant_username?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          participant_avatar?: string | null
          participant_id?: string
          participant_name?: string | null
          participant_username?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      instagram_connections: {
        Row: {
          access_token: string
          created_at: string
          id: string
          instagram_user_id: string
          instagram_username: string | null
          page_access_token: string | null
          page_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          instagram_user_id: string
          instagram_username?: string | null
          page_access_token?: string | null
          page_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          instagram_user_id?: string
          instagram_username?: string | null
          page_access_token?: string | null
          page_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      instagram_messages: {
        Row: {
          conversation_id: string
          created_at: string
          from_me: boolean | null
          id: string
          media_type: string | null
          media_url: string | null
          message_id: string
          share_link: string | null
          share_name: string | null
          status: string | null
          text: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          from_me?: boolean | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id: string
          share_link?: string | null
          share_name?: string | null
          status?: string | null
          text?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          from_me?: boolean | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string
          share_link?: string | null
          share_name?: string | null
          status?: string | null
          text?: string | null
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_group_id: string | null
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
          activity_group_id?: string | null
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
          activity_group_id?: string | null
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
      lead_custom_field_responses: {
        Row: {
          created_at: string
          field_id: string
          id: string
          lead_id: string
          response_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          lead_id: string
          response_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          lead_id?: string
          response_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_field_responses_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "sub_origin_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_onboarding_fields: {
        Row: {
          created_at: string
          description: string | null
          field_type: string
          form_id: string
          id: string
          is_required: boolean
          options: Json | null
          ordem: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          field_type: string
          form_id: string
          id?: string
          is_required?: boolean
          options?: Json | null
          ordem?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          field_type?: string
          form_id?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          ordem?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_onboarding_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "lead_onboarding_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_onboarding_forms: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_published: boolean
          is_sequential: boolean
          lead_id: string
          name: string
          published_at: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_published?: boolean
          is_sequential?: boolean
          lead_id: string
          name?: string
          published_at?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_published?: boolean
          is_sequential?: boolean
          lead_id?: string
          name?: string
          published_at?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_onboarding_forms_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_onboarding_responses: {
        Row: {
          answered_at: string
          field_id: string
          form_id: string
          id: string
          response_options: Json | null
          response_value: string | null
        }
        Insert: {
          answered_at?: string
          field_id: string
          form_id: string
          id?: string
          response_options?: Json | null
          response_value?: string | null
        }
        Update: {
          answered_at?: string
          field_id?: string
          form_id?: string
          id?: string
          response_options?: Json | null
          response_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_onboarding_responses_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "lead_onboarding_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_onboarding_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "lead_onboarding_forms"
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
          assigned_to: string | null
          average_ticket: number | null
          biggest_difficulty: string | null
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
          photo_url: string | null
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
          assigned_to?: string | null
          average_ticket?: number | null
          biggest_difficulty?: string | null
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
          photo_url?: string | null
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
          assigned_to?: string | null
          average_ticket?: number | null
          biggest_difficulty?: string | null
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
          photo_url?: string | null
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
      origin_settings: {
        Row: {
          agenda_mode: boolean
          created_at: string
          id: string
          origin_id: string
          updated_at: string
        }
        Insert: {
          agenda_mode?: boolean
          created_at?: string
          id?: string
          origin_id: string
          updated_at?: string
        }
        Update: {
          agenda_mode?: boolean
          created_at?: string
          id?: string
          origin_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      overview_cards: {
        Row: {
          card_id: string
          card_order: number
          chart_type: string
          created_at: string
          data_source: string | null
          height: number
          id: string
          sub_origin_id: string
          title: string
          updated_at: string
          width: number
          width_percent: number
        }
        Insert: {
          card_id: string
          card_order?: number
          chart_type: string
          created_at?: string
          data_source?: string | null
          height?: number
          id?: string
          sub_origin_id: string
          title: string
          updated_at?: string
          width?: number
          width_percent?: number
        }
        Update: {
          card_id?: string
          card_order?: number
          chart_type?: string
          created_at?: string
          data_source?: string | null
          height?: number
          id?: string
          sub_origin_id?: string
          title?: string
          updated_at?: string
          width?: number
          width_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "overview_cards_sub_origin_id_fkey"
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
          pipeline_id: string | null
          sub_origin_id: string | null
          target_origin_id: string | null
          target_pipeline_id: string | null
          target_sub_origin_id: string | null
          target_type: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id?: string | null
          sub_origin_id?: string | null
          target_origin_id?: string | null
          target_pipeline_id?: string | null
          target_sub_origin_id?: string | null
          target_type: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id?: string | null
          sub_origin_id?: string | null
          target_origin_id?: string | null
          target_pipeline_id?: string | null
          target_sub_origin_id?: string | null
          target_type?: string
          trigger_type?: string
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quick_messages: {
        Row: {
          audio_data: string | null
          audio_duration: number | null
          created_at: string
          id: string
          name: string
          session_id: string | null
          text: string
          type: string
          updated_at: string
        }
        Insert: {
          audio_data?: string | null
          audio_duration?: number | null
          created_at?: string
          id?: string
          name: string
          session_id?: string | null
          text: string
          type?: string
          updated_at?: string
        }
        Update: {
          audio_data?: string | null
          audio_duration?: number | null
          created_at?: string
          id?: string
          name?: string
          session_id?: string | null
          text?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
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
      scheduled_emails: {
        Row: {
          automation_id: string
          body_html: string
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          id: string
          lead_email: string
          lead_id: string
          lead_name: string
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          automation_id: string
          body_html: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          lead_email: string
          lead_id: string
          lead_name: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          automation_id?: string
          body_html?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          lead_email?: string
          lead_id?: string
          lead_name?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
      sub_origin_custom_fields: {
        Row: {
          created_at: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_required: boolean
          options: Json | null
          ordem: number
          sub_origin_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          ordem?: number
          sub_origin_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          ordem?: number
          sub_origin_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_origin_custom_fields_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          allowed_origin_ids: string[] | null
          allowed_sub_origin_ids: string[] | null
          can_access_whatsapp: boolean
          can_create_origins: boolean
          can_create_sub_origins: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_origin_ids?: string[] | null
          allowed_sub_origin_ids?: string[] | null
          can_access_whatsapp?: boolean
          can_create_origins?: boolean
          can_create_sub_origins?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_origin_ids?: string[] | null
          allowed_sub_origin_ids?: string[] | null
          can_access_whatsapp?: boolean
          can_create_origins?: boolean
          can_create_sub_origins?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
      whatsapp_chats: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_from_me: boolean | null
          last_message_status: string | null
          last_message_time: string | null
          name: string | null
          phone: string
          photo_url: string | null
          session_id: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_from_me?: boolean | null
          last_message_status?: string | null
          last_message_time?: string | null
          name?: string | null
          phone: string
          photo_url?: string | null
          session_id?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_from_me?: boolean | null
          last_message_status?: string | null
          last_message_time?: string | null
          name?: string | null
          phone?: string
          photo_url?: string | null
          session_id?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_group_participants: {
        Row: {
          created_at: string
          group_jid: string
          id: string
          is_admin: boolean | null
          is_super_admin: boolean | null
          name: string | null
          participant_jid: string
          phone: string
          photo_url: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_jid: string
          id?: string
          is_admin?: boolean | null
          is_super_admin?: boolean | null
          name?: string | null
          participant_jid: string
          phone: string
          photo_url?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_jid?: string
          id?: string
          is_admin?: boolean | null
          is_super_admin?: boolean | null
          name?: string | null
          participant_jid?: string
          phone?: string
          photo_url?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          created_at: string
          description: string | null
          group_jid: string
          id: string
          name: string
          participant_count: number | null
          photo_url: string | null
          session_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_jid: string
          id?: string
          name: string
          participant_count?: number | null
          photo_url?: string | null
          session_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_jid?: string
          id?: string
          name?: string
          participant_count?: number | null
          photo_url?: string | null
          session_id?: string | null
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
          quoted_from_me: boolean | null
          quoted_message_id: string | null
          quoted_text: string | null
          reaction: string | null
          session_id: string | null
          status: string | null
          text: string | null
          whatsapp_key_id: string | null
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
          quoted_from_me?: boolean | null
          quoted_message_id?: string | null
          quoted_text?: string | null
          reaction?: string | null
          session_id?: string | null
          status?: string | null
          text?: string | null
          whatsapp_key_id?: string | null
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
          quoted_from_me?: boolean | null
          quoted_message_id?: string | null
          quoted_text?: string | null
          reaction?: string | null
          session_id?: string | null
          status?: string | null
          text?: string | null
          whatsapp_key_id?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_unread_count: {
        Args: { chat_uuid: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "suporte" | "gestor_trafego" | "closer" | "sdr"
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
      app_role: ["admin", "suporte", "gestor_trafego", "closer", "sdr"],
    },
  },
} as const

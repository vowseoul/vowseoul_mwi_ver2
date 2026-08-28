/**
 * Supabase 프로젝트 타입 정의.
 *
 * `supabase gen types typescript --project-id ...` 로 생성하는 것이 정석이지만,
 * 이 CLI 호출은 Supabase 액세스 토큰(`supabase login` 또는 `SUPABASE_ACCESS_TOKEN`)이
 * 필요하고 이 리포에는 anon key 만 있어 실행할 수 없었다. 대신 이번 세션에 작성해
 * 실제 운영 DB에 적용·검증한 `supabase/migrations/*.sql` 4개 파일을 근거로 손으로
 * 작성했다 — 스키마가 바뀌면 이 파일도 같이 갱신해야 한다(자동 동기화 아님).
 *
 * 진짜 CLI 생성으로 교체하려면(사용자가 액세스 토큰을 가지고 있다면):
 *   npx supabase login
 *   npx supabase gen types typescript --project-id <project-ref> > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: 'ADMIN' | 'DESIGNER'
          name: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          role: 'ADMIN' | 'DESIGNER'
          name?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      customers: {
        Row: {
          id: string
          created_by: string | null
          assigned_to: string | null
          groom_name: string
          bride_name: string
          phone: string | null
          wedding_date: string
          venue_name: string
          venue_address: string
          venue_coordinates: Json | null
          transportation_info: string | null
          status: 'registered' | 'form_sent' | 'form_completed' | 'draft' | 'published' | 'expired'
          memo: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          created_by?: string | null
          assigned_to?: string | null
          groom_name: string
          bride_name: string
          phone?: string | null
          wedding_date: string
          venue_name: string
          venue_address: string
          venue_coordinates?: Json | null
          transportation_info?: string | null
          status?: 'registered' | 'form_sent' | 'form_completed' | 'draft' | 'published' | 'expired'
          memo?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      field_library: {
        Row: {
          id: string
          field_key: string
          label: string
          help_text: string | null
          field_type: 'text' | 'date' | 'time' | 'select' | 'address' | 'phone' | 'image' | 'textarea' | 'number' | 'rselect' | 'toggle' | 'images' | 'slug'
          validation_rules: Json | null
          category: string
          is_system: boolean
          created_at: string
        }
        Insert: {
          id?: string
          field_key: string
          label: string
          help_text?: string | null
          field_type: 'text' | 'date' | 'time' | 'select' | 'address' | 'phone' | 'image' | 'textarea' | 'number' | 'rselect' | 'toggle' | 'images' | 'slug'
          validation_rules?: Json | null
          category: string
          is_system?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['field_library']['Insert']>
      }
      form_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          current_version: number
          is_active: boolean
          created_by: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: string
          current_version?: number
          is_active?: boolean
          created_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['form_templates']['Insert']>
      }
      form_template_versions: {
        Row: {
          id: string
          template_id: string
          version_number: number
          fields_snapshot: Json
          change_note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          version_number: number
          fields_snapshot: Json
          change_note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['form_template_versions']['Insert']>
      }
      form_template_fields: {
        Row: {
          id: string
          template_id: string
          field_library_id: string
          label_override: string | null
          help_text_override: string | null
          is_required: boolean
          sort_order: number
          options: Json | null
        }
        Insert: {
          id?: string
          template_id: string
          field_library_id: string
          label_override?: string | null
          help_text_override?: string | null
          is_required?: boolean
          sort_order?: number
          options?: Json | null
        }
        Update: Partial<Database['public']['Tables']['form_template_fields']['Insert']>
      }
      form_instances: {
        Row: {
          id: string
          customer_id: string
          template_id: string | null
          fields_snapshot: Json
          unique_url_slug: string
          status: 'draft' | 'active' | 'completed' | 'expired'
          access_password: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          template_id?: string | null
          fields_snapshot: Json
          unique_url_slug: string
          status?: 'draft' | 'active' | 'completed' | 'expired'
          access_password?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['form_instances']['Insert']>
      }
      form_submissions: {
        Row: {
          id: string
          form_instance_id: string
          customer_id: string
          data: Json
          missing_fields: Json
          is_complete: boolean
          submitted_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          form_instance_id: string
          customer_id: string
          data: Json
          missing_fields?: Json
          is_complete?: boolean
          submitted_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['form_submissions']['Insert']>
      }
      block_library: {
        Row: {
          id: string
          block_key: string
          name: string
          description: string | null
          icon_name: string | null
          is_required: boolean
          allow_duplicate: boolean
          recommended_position: number
          default_data: Json
          default_style: Json
          created_at: string
        }
        Insert: {
          id?: string
          block_key: string
          name: string
          description?: string | null
          icon_name?: string | null
          is_required?: boolean
          allow_duplicate?: boolean
          recommended_position?: number
          default_data?: Json
          default_style?: Json
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['block_library']['Insert']>
      }
      block_variants: {
        Row: {
          id: string
          block_library_id: string
          variant_key: string
          name: string
          description: string | null
          preview_image_url: string | null
          react_component_name: string
          created_at: string
        }
        Insert: {
          id?: string
          block_library_id: string
          variant_key: string
          name: string
          description?: string | null
          preview_image_url?: string | null
          react_component_name: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['block_variants']['Insert']>
      }
      /** styles/colorSets/fontSets 등은 레거시 카드 미리보기용, template_html 이하는 B-hybrid 엔진용 (§ theme_template_engine 마이그레이션) */
      themes: {
        Row: {
          id: string
          name: string
          description: string | null
          thumbnail_url: string | null
          created_by: string | null
          is_active: boolean
          deleted_at: string | null
          created_at: string
          thumbnail: string | null
          tags: string[] | null
          layout: string | null
          recommendedBgms: Json | null
          styles: Json | null
          colorSets: Json | null
          fontSets: Json | null
          template_html: string | null
          template_css: string | null
          slot_manifest: Json
          field_manifest: Json
          render_engine: 'legacy' | 'template'
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          thumbnail_url?: string | null
          created_by?: string | null
          is_active?: boolean
          deleted_at?: string | null
          created_at?: string
          thumbnail?: string | null
          tags?: string[] | null
          layout?: string | null
          recommendedBgms?: Json | null
          styles?: Json | null
          colorSets?: Json | null
          fontSets?: Json | null
          template_html?: string | null
          template_css?: string | null
          slot_manifest?: Json
          field_manifest?: Json
          render_engine?: 'legacy' | 'template'
        }
        Update: Partial<Database['public']['Tables']['themes']['Insert']>
      }
      theme_versions: {
        Row: {
          id: string
          theme_id: string
          version_number: number
          design_tokens: Json
          block_variant_selections: Json
          default_block_order: Json
          default_block_visibility: Json
          interaction_settings: Json
          status: 'draft' | 'active' | 'deprecated'
          change_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          theme_id: string
          version_number: number
          design_tokens: Json
          block_variant_selections: Json
          default_block_order: Json
          default_block_visibility?: Json
          interaction_settings?: Json
          status?: 'draft' | 'active' | 'deprecated'
          change_note?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['theme_versions']['Insert']>
      }
      invitations: {
        Row: {
          id: string
          customer_id: string
          theme_version_id: string | null
          public_slug: string
          dashboard_slug: string
          dashboard_password: string
          content_data: Json
          customization_overrides: Json
          block_order: Json
          status: 'draft' | 'published' | 'paused' | 'expired'
          og_meta: Json
          bgm_url: string | null
          published_at: string | null
          expires_at: string
          deleted_at: string | null
          created_at: string
          updated_at: string
          review_status: 'none' | 'in_review' | 'changes_requested' | 'approved'
          review_round: number
        }
        Insert: {
          id?: string
          customer_id: string
          theme_version_id?: string | null
          public_slug: string
          dashboard_slug: string
          dashboard_password: string
          content_data?: Json
          customization_overrides?: Json
          block_order: Json
          status?: 'draft' | 'published' | 'paused' | 'expired'
          og_meta?: Json
          bgm_url?: string | null
          published_at?: string | null
          expires_at: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
          review_status?: 'none' | 'in_review' | 'changes_requested' | 'approved'
          review_round?: number
        }
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>
      }
      invitation_revisions: {
        Row: {
          id: string
          invitation_id: string
          round: number
          block_key: string | null
          note: string
          status: 'open' | 'resolved'
          resolved_by: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          invitation_id: string
          round?: number
          block_key?: string | null
          note: string
          status?: 'open' | 'resolved'
          resolved_by?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['invitation_revisions']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          invitation_id: string | null
          actor_type: 'admin' | 'customer' | 'system'
          actor_label: string | null
          action: string
          summary: string
          created_at: string
        }
        Insert: {
          id?: string
          invitation_id?: string | null
          actor_type: 'admin' | 'customer' | 'system'
          actor_label?: string | null
          action: string
          summary: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
      }
      rate_limit_attempts: {
        Row: {
          id: string
          scope: string
          identifier: string
          created_at: string
        }
        Insert: {
          id?: string
          scope: string
          identifier: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['rate_limit_attempts']['Insert']>
      }
      rsvp_responses_history: {
        Row: {
          id: string
          rsvp_response_id: string
          invitation_id: string
          guest_name: string | null
          phone: string | null
          side: string | null
          is_attending: boolean | null
          party_size: number | null
          meal_required: boolean | null
          meal_choice: string | null
          shuttle_required: boolean | null
          replaced_at: string
        }
        Insert: {
          id?: string
          rsvp_response_id: string
          invitation_id: string
          guest_name?: string | null
          phone?: string | null
          side?: string | null
          is_attending?: boolean | null
          party_size?: number | null
          meal_required?: boolean | null
          meal_choice?: string | null
          shuttle_required?: boolean | null
          replaced_at?: string
        }
        Update: Partial<Database['public']['Tables']['rsvp_responses_history']['Insert']>
      }
      invitation_blocks: {
        Row: {
          id: string
          invitation_id: string
          block_library_id: string
          block_variant_id: string
          sort_order: number
          is_visible: boolean
          use_data_binding: boolean
          block_data: Json
          style_overrides: Json
        }
        Insert: {
          id?: string
          invitation_id: string
          block_library_id: string
          block_variant_id: string
          sort_order?: number
          is_visible?: boolean
          use_data_binding?: boolean
          block_data?: Json
          style_overrides?: Json
        }
        Update: Partial<Database['public']['Tables']['invitation_blocks']['Insert']>
      }
      rsvp_responses: {
        Row: {
          id: string
          invitation_id: string
          guest_name: string
          phone: string
          side: 'groom' | 'bride'
          is_attending: boolean
          party_size: number
          meal_required: boolean
          meal_choice: string | null
          shuttle_required: boolean
          created_at: string
        }
        Insert: {
          id?: string
          invitation_id: string
          guest_name: string
          phone: string
          side: 'groom' | 'bride'
          is_attending?: boolean
          party_size?: number
          meal_required?: boolean
          meal_choice?: string | null
          shuttle_required?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['rsvp_responses']['Insert']>
      }
      /** password_hash 는 컬럼상 NOT NULL 이지만 자기 글 삭제 UI가 없어 실질적으로 빈 문자열 자리표시자로만 쓰인다 (WORKPLAN.md §1-A 부속) */
      guestbook_entries: {
        Row: {
          id: string
          invitation_id: string
          author_name: string
          message: string
          password_hash: string
          is_visible: boolean
          created_at: string
        }
        Insert: {
          id?: string
          invitation_id: string
          author_name: string
          message: string
          password_hash: string
          is_visible?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['guestbook_entries']['Insert']>
      }
      /** ip_hash 도 NOT NULL 이지만 실제 해시는 서버에서 계산해야 정확하다 — 현재 클라이언트에서 'unknown' 자리표시자로 채워짐 (WORKPLAN.md §1-A 부속) */
      visit_logs: {
        Row: {
          id: string
          invitation_id: string
          ip_hash: string
          user_agent: string | null
          referrer: string | null
          visited_at: string
        }
        Insert: {
          id?: string
          invitation_id: string
          ip_hash: string
          user_agent?: string | null
          referrer?: string | null
          visited_at?: string
        }
        Update: Partial<Database['public']['Tables']['visit_logs']['Insert']>
      }
      visit_daily_stats: {
        Row: {
          id: string
          invitation_id: string
          visit_date: string
          total_visits: number
          unique_visitors: number
        }
        Insert: {
          id?: string
          invitation_id: string
          visit_date: string
          total_visits?: number
          unique_visitors?: number
        }
        Update: Partial<Database['public']['Tables']['visit_daily_stats']['Insert']>
      }
      account_info: {
        Row: {
          id: string
          invitation_id: string
          side: 'groom' | 'bride' | 'groom_father' | 'groom_mother' | 'bride_father' | 'bride_mother'
          bank_name: string
          account_number: string
          account_holder: string
          sort_order: number
        }
        Insert: {
          id?: string
          invitation_id: string
          side: 'groom' | 'bride' | 'groom_father' | 'groom_mother' | 'bride_father' | 'bride_mother'
          bank_name: string
          account_number: string
          account_holder: string
          sort_order?: number
        }
        Update: Partial<Database['public']['Tables']['account_info']['Insert']>
      }
      archived_invitations: {
        Row: {
          id: string
          original_invitation_id: string
          full_snapshot: Json
          rsvp_snapshot: Json | null
          guestbook_snapshot: Json | null
          visit_stats_snapshot: Json | null
          archived_at: string
        }
        Insert: {
          id?: string
          original_invitation_id: string
          full_snapshot: Json
          rsvp_snapshot?: Json | null
          guestbook_snapshot?: Json | null
          visit_stats_snapshot?: Json | null
          archived_at?: string
        }
        Update: Partial<Database['public']['Tables']['archived_invitations']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          type: 'form_submitted' | 'draft_failed' | 'link_expiring' | 'theme_error'
          title: string
          message: string
          link_to: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          type: 'form_submitted' | 'draft_failed' | 'link_expiring' | 'theme_error'
          title: string
          message: string
          link_to?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      /** 공통 설정 키-값 저장소 (fonts, logo_image 등) */
      settings: {
        Row: {
          key: string
          value: Json
          created_at: string
        }
        Insert: {
          key: string
          value: Json
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['settings']['Insert']>
      }
      /** 결제 트랜잭션이 아니라 제작 의뢰 이행 기록 — 실제 결제는 네이버 스마트스토어에서 앱 밖에서 발생 (WORKPLAN.md §1-B) */
      orders: {
        Row: {
          id: string
          customer_id: string | null
          invitation_id: string | null
          product_type: 'mobile' | 'offline' | 'both'
          external_order_ref: string | null
          amount: number
          status: 'registered' | 'form_sent' | 'form_completed' | 'in_production' | 'design_review' | 'published' | 'delivered'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          invitation_id?: string | null
          product_type?: 'mobile' | 'offline' | 'both'
          external_order_ref?: string | null
          amount?: number
          status?: 'registered' | 'form_sent' | 'form_completed' | 'in_production' | 'design_review' | 'published' | 'delivered'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      bgms: {
        Row: {
          id: string
          name: string
          url: string
          artist: string | null
          duration: string | null
          is_active: boolean
          created_at: string
          genre: string | null
          hashtags: string | null
        }
        Insert: {
          id?: string
          name: string
          url: string
          artist?: string | null
          duration?: string | null
          is_active?: boolean
          created_at?: string
          genre?: string | null
          hashtags?: string | null
        }
        Update: Partial<Database['public']['Tables']['bgms']['Insert']>
      }
      faqs: {
        Row: {
          id: string
          question: string
          answer: string
          category: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          question: string
          answer: string
          category?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['faqs']['Insert']>
      }
      notices: {
        Row: {
          id: string
          title: string
          content: string
          is_pinned: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          is_pinned?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['notices']['Insert']>
      }
      inquiries: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          message: string
          status: 'new' | 'read' | 'replied'
          created_at: string
          subject: string | null
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          message: string
          status?: 'new' | 'read' | 'replied'
          created_at?: string
          subject?: string | null
        }
        Update: Partial<Database['public']['Tables']['inquiries']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: {
      upsert_rsvp_response: {
        Args: {
          p_invitation_id: string
          p_guest_name: string
          p_phone: string
          p_side: string
          p_is_attending: boolean
          p_party_size: number
          p_meal_required: boolean
          p_meal_choice: string | null
          p_shuttle_required: boolean
        }
        Returns: Database['public']['Tables']['rsvp_responses']['Row']
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

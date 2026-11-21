export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          at: string;
          details: NonNullable<Json>;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          at?: string;
          details?: NonNullable<Json>;
          entity: string;
          entity_id?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          at?: string;
          details?: NonNullable<Json>;
          entity?: string;
          entity_id?: string | null;
          id?: never;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          document_version: string;
          given_at: string;
          given_by_profile_id: string;
          id: string;
          ip_hash: string | null;
          revoked_at: string | null;
          subject_profile_id: string;
          type: Database['public']['Enums']['legal_document_type'];
        };
        ComputedFields: never;
        Insert: {
          document_version: string;
          given_at?: string;
          given_by_profile_id: string;
          id?: string;
          ip_hash?: string | null;
          revoked_at?: string | null;
          subject_profile_id: string;
          type: Database['public']['Enums']['legal_document_type'];
        };
        Update: {
          document_version?: string;
          given_at?: string;
          given_by_profile_id?: string;
          id?: string;
          ip_hash?: string | null;
          revoked_at?: string | null;
          subject_profile_id?: string;
          type?: Database['public']['Enums']['legal_document_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'consents_given_by_profile_id_fkey';
            columns: ['given_by_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'consents_subject_profile_id_fkey';
            columns: ['subject_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      curricula: {
        Row: {
          academic_year: string | null;
          code: string;
          created_at: string;
          id: string;
          is_default: boolean;
        };
        ComputedFields: never;
        Insert: {
          academic_year?: string | null;
          code: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
        };
        Update: {
          academic_year?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
        };
        Relationships: [];
      };
      curriculum_section_translations: {
        Row: {
          locale: Database['public']['Enums']['app_locale'];
          section_id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          locale: Database['public']['Enums']['app_locale'];
          section_id: string;
          title: string;
        };
        Update: {
          locale?: Database['public']['Enums']['app_locale'];
          section_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'curriculum_section_translations_section_id_fkey';
            columns: ['section_id'];
            isOneToOne: false;
            referencedRelation: 'curriculum_sections';
            referencedColumns: ['id'];
          },
        ];
      };
      curriculum_sections: {
        Row: {
          created_at: string;
          curriculum_id: string;
          grade: number;
          id: string;
          quarter: number;
          sort: number;
          subject_code: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          curriculum_id: string;
          grade: number;
          id?: string;
          quarter: number;
          sort?: number;
          subject_code: string;
        };
        Update: {
          created_at?: string;
          curriculum_id?: string;
          grade?: number;
          id?: string;
          quarter?: number;
          sort?: number;
          subject_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'curriculum_sections_curriculum_id_fkey';
            columns: ['curriculum_id'];
            isOneToOne: false;
            referencedRelation: 'curricula';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'curriculum_sections_subject_code_fkey';
            columns: ['subject_code'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['code'];
          },
        ];
      };
      curriculum_topics: {
        Row: {
          section_id: string;
          sort: number;
          topic_id: string;
        };
        ComputedFields: never;
        Insert: {
          section_id: string;
          sort?: number;
          topic_id: string;
        };
        Update: {
          section_id?: string;
          sort?: number;
          topic_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'curriculum_topics_section_id_fkey';
            columns: ['section_id'];
            isOneToOne: false;
            referencedRelation: 'curriculum_sections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'curriculum_topics_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
        ];
      };
      curriculum_translations: {
        Row: {
          curriculum_id: string;
          locale: Database['public']['Enums']['app_locale'];
          title: string;
        };
        ComputedFields: never;
        Insert: {
          curriculum_id: string;
          locale: Database['public']['Enums']['app_locale'];
          title: string;
        };
        Update: {
          curriculum_id?: string;
          locale?: Database['public']['Enums']['app_locale'];
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'curriculum_translations_curriculum_id_fkey';
            columns: ['curriculum_id'];
            isOneToOne: false;
            referencedRelation: 'curricula';
            referencedColumns: ['id'];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          formula_id: string;
          profile_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          formula_id: string;
          profile_id: string;
        };
        Update: {
          created_at?: string;
          formula_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_formula_id_fkey';
            columns: ['formula_id'];
            isOneToOne: false;
            referencedRelation: 'formulas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorites_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      formula_translations: {
        Row: {
          description: string;
          formula_id: string;
          locale: Database['public']['Enums']['app_locale'];
          name: string;
          variables: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          description?: string;
          formula_id: string;
          locale: Database['public']['Enums']['app_locale'];
          name: string;
          variables?: NonNullable<Json>;
        };
        Update: {
          description?: string;
          formula_id?: string;
          locale?: Database['public']['Enums']['app_locale'];
          name?: string;
          variables?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'formula_translations_formula_id_fkey';
            columns: ['formula_id'];
            isOneToOne: false;
            referencedRelation: 'formulas';
            referencedColumns: ['id'];
          },
        ];
      };
      formulas: {
        Row: {
          code: string;
          created_by: string | null;
          grade_from: number;
          grade_to: number;
          id: string;
          latex: string;
          published_at: string | null;
          reviewed_by: string | null;
          status: Database['public']['Enums']['formula_status'];
          subject_code: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_by?: string | null;
          grade_from: number;
          grade_to: number;
          id?: string;
          latex: string;
          published_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['formula_status'];
          subject_code: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_by?: string | null;
          grade_from?: number;
          grade_to?: number;
          id?: string;
          latex?: string;
          published_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['formula_status'];
          subject_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'formulas_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'formulas_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'formulas_subject_code_fkey';
            columns: ['subject_code'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['code'];
          },
        ];
      };
      legal_documents: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          is_draft: boolean;
          locale: Database['public']['Enums']['app_locale'];
          published_at: string | null;
          title: string;
          type: Database['public']['Enums']['legal_document_type'];
          version: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          is_draft?: boolean;
          locale: Database['public']['Enums']['app_locale'];
          published_at?: string | null;
          title: string;
          type: Database['public']['Enums']['legal_document_type'];
          version: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          is_draft?: boolean;
          locale?: Database['public']['Enums']['app_locale'];
          published_at?: string | null;
          title?: string;
          type?: Database['public']['Enums']['legal_document_type'];
          version?: string;
        };
        Relationships: [];
      };
      parent_student_links: {
        Row: {
          created_at: string;
          parent_id: string;
          revoked_at: string | null;
          status: Database['public']['Enums']['link_status'];
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          parent_id: string;
          revoked_at?: string | null;
          status?: Database['public']['Enums']['link_status'];
          student_id: string;
        };
        Update: {
          created_at?: string;
          parent_id?: string;
          revoked_at?: string | null;
          status?: Database['public']['Enums']['link_status'];
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parent_student_links_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parent_student_links_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          locale: Database['public']['Enums']['app_locale'];
          role: Database['public']['Enums']['app_role'];
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          locale?: Database['public']['Enums']['app_locale'];
          role: Database['public']['Enums']['app_role'];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          locale?: Database['public']['Enums']['app_locale'];
          role?: Database['public']['Enums']['app_role'];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_profiles: {
        Row: {
          created_at: string;
          grade: number;
          profile_id: string;
          updated_at: string;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          grade: number;
          profile_id: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          created_at?: string;
          grade?: number;
          profile_id?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_profiles_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      subject_translations: {
        Row: {
          locale: Database['public']['Enums']['app_locale'];
          name: string;
          subject_code: string;
        };
        ComputedFields: never;
        Insert: {
          locale: Database['public']['Enums']['app_locale'];
          name: string;
          subject_code: string;
        };
        Update: {
          locale?: Database['public']['Enums']['app_locale'];
          name?: string;
          subject_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subject_translations_subject_code_fkey';
            columns: ['subject_code'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['code'];
          },
        ];
      };
      subjects: {
        Row: {
          code: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          sort?: number;
        };
        Update: {
          code?: string;
          sort?: number;
        };
        Relationships: [];
      };
      topic_contents: {
        Row: {
          locale: Database['public']['Enums']['app_locale'];
          mistakes: string[];
          objectives: string[];
          published_at: string;
          published_by: string | null;
          summary: string;
          theory: string;
          title: string;
          topic_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          locale: Database['public']['Enums']['app_locale'];
          mistakes?: string[];
          objectives?: string[];
          published_at?: string;
          published_by?: string | null;
          summary?: string;
          theory: string;
          title: string;
          topic_id: string;
          version?: number;
        };
        Update: {
          locale?: Database['public']['Enums']['app_locale'];
          mistakes?: string[];
          objectives?: string[];
          published_at?: string;
          published_by?: string | null;
          summary?: string;
          theory?: string;
          title?: string;
          topic_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'topic_contents_published_by_fkey';
            columns: ['published_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'topic_contents_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
        ];
      };
      topic_drafts: {
        Row: {
          is_machine_translation: boolean;
          locale: Database['public']['Enums']['app_locale'];
          mistakes: string[];
          objectives: string[];
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database['public']['Enums']['draft_status'];
          submitted_at: string | null;
          summary: string;
          theory: string;
          title: string;
          topic_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          is_machine_translation?: boolean;
          locale: Database['public']['Enums']['app_locale'];
          mistakes?: string[];
          objectives?: string[];
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['draft_status'];
          submitted_at?: string | null;
          summary?: string;
          theory?: string;
          title: string;
          topic_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          is_machine_translation?: boolean;
          locale?: Database['public']['Enums']['app_locale'];
          mistakes?: string[];
          objectives?: string[];
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['draft_status'];
          submitted_at?: string | null;
          summary?: string;
          theory?: string;
          title?: string;
          topic_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'topic_drafts_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'topic_drafts_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'topic_drafts_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      topics: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          slug: string;
          subject_code: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          slug: string;
          subject_code: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          slug?: string;
          subject_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'topics_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'topics_subject_code_fkey';
            columns: ['subject_code'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['code'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      find_user_by_email: {
        Args: { p_email: string };
        Returns: {
          display_name: string;
          email: string;
          id: string;
          role: Database['public']['Enums']['app_role'];
        }[];
      };
      publish_topic: {
        Args: { p_locale: Database['public']['Enums']['app_locale']; p_topic: string };
        Returns: number;
      };
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
      register_student: {
        Args: {
          p_consent_version: string;
          p_display_name: string;
          p_grade: number;
          p_ip_hash?: string;
          p_parent: string;
          p_student: string;
          p_username: string;
        };
        Returns: undefined;
      };
      request_topic_changes: {
        Args: {
          p_locale: Database['public']['Enums']['app_locale'];
          p_note: string;
          p_topic: string;
        };
        Returns: undefined;
      };
      set_formula_status: {
        Args: { p_formula: string; p_status: Database['public']['Enums']['formula_status'] };
        Returns: undefined;
      };
      set_user_role: {
        Args: { p_role: Database['public']['Enums']['app_role']; p_user: string };
        Returns: undefined;
      };
      submit_topic_draft: {
        Args: { p_locale: Database['public']['Enums']['app_locale']; p_topic: string };
        Returns: undefined;
      };
      unpublish_topic: {
        Args: { p_locale: Database['public']['Enums']['app_locale']; p_topic: string };
        Returns: undefined;
      };
      write_audit: {
        Args: {
          p_action: string;
          p_actor: string;
          p_details?: Json;
          p_entity: string;
          p_entity_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_locale: 'ru' | 'kk';
      app_role: 'student' | 'parent' | 'content_manager' | 'reviewer' | 'admin' | 'support';
      draft_status: 'draft' | 'in_review' | 'approved';
      formula_status: 'draft' | 'in_review' | 'published';
      legal_document_type: 'pd_processing' | 'child_pd_processing' | 'offer' | 'terms';
      link_status: 'active' | 'revoked';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_locale: ['ru', 'kk'],
      app_role: ['student', 'parent', 'content_manager', 'reviewer', 'admin', 'support'],
      draft_status: ['draft', 'in_review', 'approved'],
      formula_status: ['draft', 'in_review', 'published'],
      legal_document_type: ['pd_processing', 'child_pd_processing', 'offer', 'terms'],
      link_status: ['active', 'revoked'],
    },
  },
} as const;

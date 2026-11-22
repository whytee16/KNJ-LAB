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
      attempt_answers: {
        Row: {
          answer: NonNullable<Json>;
          attempt_id: string;
          created_at: string;
          id: string;
          idempotency_key: string;
          instance_id: string;
          score: number;
          status: Database['public']['Enums']['answer_status'];
          time_ms: number | null;
        };
        ComputedFields: never;
        Insert: {
          answer: NonNullable<Json>;
          attempt_id: string;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          instance_id: string;
          score: number;
          status: Database['public']['Enums']['answer_status'];
          time_ms?: number | null;
        };
        Update: {
          answer?: NonNullable<Json>;
          attempt_id?: string;
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          instance_id?: string;
          score?: number;
          status?: Database['public']['Enums']['answer_status'];
          time_ms?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attempt_answers_attempt_id_fkey';
            columns: ['attempt_id'];
            isOneToOne: false;
            referencedRelation: 'attempts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attempt_answers_instance_id_fkey';
            columns: ['instance_id'];
            isOneToOne: true;
            referencedRelation: 'task_instances';
            referencedColumns: ['id'];
          },
        ];
      };
      attempts: {
        Row: {
          deadline_at: string | null;
          finished_at: string | null;
          id: string;
          kind: Database['public']['Enums']['attempt_kind'];
          lab_id: string | null;
          max_score: number | null;
          score: number | null;
          started_at: string;
          student_id: string;
          test_id: string | null;
          trainer_run_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          deadline_at?: string | null;
          finished_at?: string | null;
          id?: string;
          kind: Database['public']['Enums']['attempt_kind'];
          lab_id?: string | null;
          max_score?: number | null;
          score?: number | null;
          started_at?: string;
          student_id: string;
          test_id?: string | null;
          trainer_run_id?: string | null;
        };
        Update: {
          deadline_at?: string | null;
          finished_at?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['attempt_kind'];
          lab_id?: string | null;
          max_score?: number | null;
          score?: number | null;
          started_at?: string;
          student_id?: string;
          test_id?: string | null;
          trainer_run_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attempts_lab_id_fkey';
            columns: ['lab_id'];
            isOneToOne: false;
            referencedRelation: 'labs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attempts_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attempts_test_id_fkey';
            columns: ['test_id'];
            isOneToOne: false;
            referencedRelation: 'tests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attempts_trainer_run_id_fkey';
            columns: ['trainer_run_id'];
            isOneToOne: false;
            referencedRelation: 'trainer_runs';
            referencedColumns: ['id'];
          },
        ];
      };
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
      content_reports: {
        Row: {
          created_at: string;
          id: string;
          instance_id: string | null;
          message: string;
          reporter_id: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database['public']['Enums']['report_status'];
          template_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          instance_id?: string | null;
          message: string;
          reporter_id?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['report_status'];
          template_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          instance_id?: string | null;
          message?: string;
          reporter_id?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['report_status'];
          template_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'content_reports_instance_id_fkey';
            columns: ['instance_id'];
            isOneToOne: false;
            referencedRelation: 'task_instances';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_reports_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_reports_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'task_templates';
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
      entitlements: {
        Row: {
          created_at: string;
          ends_at: string;
          granted_by: string | null;
          id: string;
          reason: string | null;
          revoked_at: string | null;
          source: string;
          starts_at: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at: string;
          granted_by?: string | null;
          id?: string;
          reason?: string | null;
          revoked_at?: string | null;
          source?: string;
          starts_at?: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          granted_by?: string | null;
          id?: string;
          reason?: string | null;
          revoked_at?: string | null;
          source?: string;
          starts_at?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'entitlements_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'entitlements_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
      lab_sessions: {
        Row: {
          answers: NonNullable<Json>;
          attempt_id: string | null;
          duration_s: number;
          id: string;
          lab_id: string;
          params: NonNullable<Json>;
          started_at: string;
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          answers?: NonNullable<Json>;
          attempt_id?: string | null;
          duration_s?: number;
          id?: string;
          lab_id: string;
          params?: NonNullable<Json>;
          started_at?: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          answers?: NonNullable<Json>;
          attempt_id?: string | null;
          duration_s?: number;
          id?: string;
          lab_id?: string;
          params?: NonNullable<Json>;
          started_at?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lab_sessions_attempt_id_fkey';
            columns: ['attempt_id'];
            isOneToOne: false;
            referencedRelation: 'attempts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lab_sessions_lab_id_fkey';
            columns: ['lab_id'];
            isOneToOne: false;
            referencedRelation: 'labs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lab_sessions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lab_tasks: {
        Row: {
          lab_id: string;
          position: number;
          template_id: string;
        };
        ComputedFields: never;
        Insert: {
          lab_id: string;
          position?: number;
          template_id: string;
        };
        Update: {
          lab_id?: string;
          position?: number;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lab_tasks_lab_id_fkey';
            columns: ['lab_id'];
            isOneToOne: false;
            referencedRelation: 'labs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lab_tasks_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'task_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      lab_topics: {
        Row: {
          lab_id: string;
          topic_id: string;
        };
        ComputedFields: never;
        Insert: {
          lab_id: string;
          topic_id: string;
        };
        Update: {
          lab_id?: string;
          topic_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lab_topics_lab_id_fkey';
            columns: ['lab_id'];
            isOneToOne: false;
            referencedRelation: 'labs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lab_topics_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
        ];
      };
      lab_translations: {
        Row: {
          content_origin: Database['public']['Enums']['content_origin'];
          goal: string;
          hints: string[];
          lab_id: string;
          locale: Database['public']['Enums']['app_locale'];
          steps: string[];
          title: string;
          translation_status: Database['public']['Enums']['draft_status'];
        };
        ComputedFields: never;
        Insert: {
          content_origin?: Database['public']['Enums']['content_origin'];
          goal?: string;
          hints?: string[];
          lab_id: string;
          locale: Database['public']['Enums']['app_locale'];
          steps?: string[];
          title: string;
          translation_status?: Database['public']['Enums']['draft_status'];
        };
        Update: {
          content_origin?: Database['public']['Enums']['content_origin'];
          goal?: string;
          hints?: string[];
          lab_id?: string;
          locale?: Database['public']['Enums']['app_locale'];
          steps?: string[];
          title?: string;
          translation_status?: Database['public']['Enums']['draft_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'lab_translations_lab_id_fkey';
            columns: ['lab_id'];
            isOneToOne: false;
            referencedRelation: 'labs';
            referencedColumns: ['id'];
          },
        ];
      };
      labs: {
        Row: {
          code: string;
          created_at: string;
          default_params: NonNullable<Json>;
          grade_from: number;
          id: string;
          is_free_demo: boolean;
          kind: Database['public']['Enums']['lab_kind'];
          published_at: string | null;
          reviewed_by: string | null;
          sort: number;
          status: Database['public']['Enums']['formula_status'];
          subject_code: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          default_params?: NonNullable<Json>;
          grade_from?: number;
          id?: string;
          is_free_demo?: boolean;
          kind: Database['public']['Enums']['lab_kind'];
          published_at?: string | null;
          reviewed_by?: string | null;
          sort?: number;
          status?: Database['public']['Enums']['formula_status'];
          subject_code: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          default_params?: NonNullable<Json>;
          grade_from?: number;
          id?: string;
          is_free_demo?: boolean;
          kind?: Database['public']['Enums']['lab_kind'];
          published_at?: string | null;
          reviewed_by?: string | null;
          sort?: number;
          status?: Database['public']['Enums']['formula_status'];
          subject_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'labs_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'labs_subject_code_fkey';
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
      task_instance_keys: {
        Row: {
          expected: NonNullable<Json>;
          instance_id: string;
          solution: string;
        };
        ComputedFields: never;
        Insert: {
          expected: NonNullable<Json>;
          instance_id: string;
          solution?: string;
        };
        Update: {
          expected?: NonNullable<Json>;
          instance_id?: string;
          solution?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_instance_keys_instance_id_fkey';
            columns: ['instance_id'];
            isOneToOne: true;
            referencedRelation: 'task_instances';
            referencedColumns: ['id'];
          },
        ];
      };
      task_instances: {
        Row: {
          attempt_id: string;
          created_at: string;
          id: string;
          locale: Database['public']['Enums']['app_locale'];
          params: NonNullable<Json>;
          position: number;
          prompt: NonNullable<Json>;
          seed: number;
          student_id: string;
          template_id: string;
          template_version: number;
        };
        ComputedFields: never;
        Insert: {
          attempt_id: string;
          created_at?: string;
          id?: string;
          locale: Database['public']['Enums']['app_locale'];
          params?: NonNullable<Json>;
          position?: number;
          prompt: NonNullable<Json>;
          seed: number;
          student_id: string;
          template_id: string;
          template_version: number;
        };
        Update: {
          attempt_id?: string;
          created_at?: string;
          id?: string;
          locale?: Database['public']['Enums']['app_locale'];
          params?: NonNullable<Json>;
          position?: number;
          prompt?: NonNullable<Json>;
          seed?: number;
          student_id?: string;
          template_id?: string;
          template_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'task_instances_attempt_id_fkey';
            columns: ['attempt_id'];
            isOneToOne: false;
            referencedRelation: 'attempts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_instances_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_instances_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'task_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      task_template_texts: {
        Row: {
          locale: Database['public']['Enums']['app_locale'];
          template_id: string;
          texts: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          locale: Database['public']['Enums']['app_locale'];
          template_id: string;
          texts: NonNullable<Json>;
        };
        Update: {
          locale?: Database['public']['Enums']['app_locale'];
          template_id?: string;
          texts?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'task_template_texts_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'task_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      task_templates: {
        Row: {
          content_origin: Database['public']['Enums']['content_origin'];
          created_at: string;
          created_by: string | null;
          difficulty: Database['public']['Enums']['difficulty'];
          id: string;
          published_at: string | null;
          reviewed_by: string | null;
          spec: NonNullable<Json>;
          status: Database['public']['Enums']['formula_status'];
          topic_id: string;
          type: Database['public']['Enums']['task_type'];
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          content_origin?: Database['public']['Enums']['content_origin'];
          created_at?: string;
          created_by?: string | null;
          difficulty: Database['public']['Enums']['difficulty'];
          id?: string;
          published_at?: string | null;
          reviewed_by?: string | null;
          spec: NonNullable<Json>;
          status?: Database['public']['Enums']['formula_status'];
          topic_id: string;
          type: Database['public']['Enums']['task_type'];
          updated_at?: string;
          version?: number;
        };
        Update: {
          content_origin?: Database['public']['Enums']['content_origin'];
          created_at?: string;
          created_by?: string | null;
          difficulty?: Database['public']['Enums']['difficulty'];
          id?: string;
          published_at?: string | null;
          reviewed_by?: string | null;
          spec?: NonNullable<Json>;
          status?: Database['public']['Enums']['formula_status'];
          topic_id?: string;
          type?: Database['public']['Enums']['task_type'];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'task_templates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_templates_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_templates_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
        ];
      };
      test_texts: {
        Row: {
          description: string;
          locale: Database['public']['Enums']['app_locale'];
          test_id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          description?: string;
          locale: Database['public']['Enums']['app_locale'];
          test_id: string;
          title: string;
        };
        Update: {
          description?: string;
          locale?: Database['public']['Enums']['app_locale'];
          test_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'test_texts_test_id_fkey';
            columns: ['test_id'];
            isOneToOne: false;
            referencedRelation: 'tests';
            referencedColumns: ['id'];
          },
        ];
      };
      tests: {
        Row: {
          counts: NonNullable<Json>;
          created_by: string | null;
          grade: number | null;
          id: string;
          mode: Database['public']['Enums']['test_mode'];
          published_at: string | null;
          quarter: number | null;
          reviewed_by: string | null;
          scope: Database['public']['Enums']['test_scope'];
          section_id: string | null;
          status: Database['public']['Enums']['formula_status'];
          subject_code: string | null;
          time_limit_s: number | null;
          topic_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          counts?: NonNullable<Json>;
          created_by?: string | null;
          grade?: number | null;
          id?: string;
          mode?: Database['public']['Enums']['test_mode'];
          published_at?: string | null;
          quarter?: number | null;
          reviewed_by?: string | null;
          scope: Database['public']['Enums']['test_scope'];
          section_id?: string | null;
          status?: Database['public']['Enums']['formula_status'];
          subject_code?: string | null;
          time_limit_s?: number | null;
          topic_id?: string | null;
          updated_at?: string;
        };
        Update: {
          counts?: NonNullable<Json>;
          created_by?: string | null;
          grade?: number | null;
          id?: string;
          mode?: Database['public']['Enums']['test_mode'];
          published_at?: string | null;
          quarter?: number | null;
          reviewed_by?: string | null;
          scope?: Database['public']['Enums']['test_scope'];
          section_id?: string | null;
          status?: Database['public']['Enums']['formula_status'];
          subject_code?: string | null;
          time_limit_s?: number | null;
          topic_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tests_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tests_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tests_section_id_fkey';
            columns: ['section_id'];
            isOneToOne: false;
            referencedRelation: 'curriculum_sections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tests_subject_code_fkey';
            columns: ['subject_code'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'tests_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
        ];
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
          content_origin: Database['public']['Enums']['content_origin'];
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
          content_origin?: Database['public']['Enums']['content_origin'];
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
          content_origin?: Database['public']['Enums']['content_origin'];
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
      trainer_runs: {
        Row: {
          correct: number;
          difficulty: Database['public']['Enums']['difficulty'];
          finished_at: string | null;
          id: string;
          last_activity_at: string;
          solved: number;
          started_at: string;
          status: string;
          student_id: string;
          target: number;
          topic_id: string;
        };
        ComputedFields: never;
        Insert: {
          correct?: number;
          difficulty: Database['public']['Enums']['difficulty'];
          finished_at?: string | null;
          id?: string;
          last_activity_at?: string;
          solved?: number;
          started_at?: string;
          status?: string;
          student_id: string;
          target?: number;
          topic_id: string;
        };
        Update: {
          correct?: number;
          difficulty?: Database['public']['Enums']['difficulty'];
          finished_at?: string | null;
          id?: string;
          last_activity_at?: string;
          solved?: number;
          started_at?: string;
          status?: string;
          student_id?: string;
          target?: number;
          topic_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_runs_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_runs_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
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
      grant_entitlement: {
        Args: { p_days: number; p_reason: string; p_student: string };
        Returns: string;
      };
      mark_content_reviewed: {
        Args: {
          p_id: string;
          p_kind: string;
          p_locale?: Database['public']['Enums']['app_locale'];
        };
        Returns: undefined;
      };
      publish_topic: {
        Args: { p_locale: Database['public']['Enums']['app_locale']; p_topic: string };
        Returns: number;
      };
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
      record_trainer_answer: {
        Args: { p_correct: boolean; p_run: string };
        Returns: {
          correct: number;
          difficulty: Database['public']['Enums']['difficulty'];
          finished_at: string | null;
          id: string;
          last_activity_at: string;
          solved: number;
          started_at: string;
          status: string;
          student_id: string;
          target: number;
          topic_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'trainer_runs';
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      revoke_entitlement: { Args: { p_id: string }; Returns: undefined };
      set_formula_status: {
        Args: { p_formula: string; p_status: Database['public']['Enums']['formula_status'] };
        Returns: undefined;
      };
      set_lab_status: {
        Args: { p_lab: string; p_status: Database['public']['Enums']['formula_status'] };
        Returns: undefined;
      };
      set_task_template_status: {
        Args: { p_status: Database['public']['Enums']['formula_status']; p_template: string };
        Returns: undefined;
      };
      set_test_status: {
        Args: { p_status: Database['public']['Enums']['formula_status']; p_test: string };
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
      answer_status: 'correct' | 'wrong';
      app_locale: 'ru' | 'kk';
      app_role: 'student' | 'parent' | 'content_manager' | 'reviewer' | 'admin' | 'support';
      attempt_kind: 'trainer' | 'test' | 'lab';
      content_origin: 'human' | 'ai_draft' | 'ai_reviewed';
      difficulty: 'easy' | 'medium' | 'sufficient' | 'hard';
      draft_status: 'draft' | 'in_review' | 'approved';
      formula_status: 'draft' | 'in_review' | 'published';
      lab_kind: 'physics' | 'geometry2d' | 'geometry3d';
      legal_document_type: 'pd_processing' | 'child_pd_processing' | 'offer' | 'terms';
      link_status: 'active' | 'revoked';
      report_status: 'open' | 'resolved' | 'rejected';
      task_type:
        | 'single_choice'
        | 'multi_choice'
        | 'number'
        | 'formula'
        | 'cloze_word'
        | 'matching'
        | 'ordering';
      test_mode: 'practice' | 'exam';
      test_scope: 'topic' | 'section' | 'quarter' | 'grade' | 'subject';
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
      answer_status: ['correct', 'wrong'],
      app_locale: ['ru', 'kk'],
      app_role: ['student', 'parent', 'content_manager', 'reviewer', 'admin', 'support'],
      attempt_kind: ['trainer', 'test', 'lab'],
      content_origin: ['human', 'ai_draft', 'ai_reviewed'],
      difficulty: ['easy', 'medium', 'sufficient', 'hard'],
      draft_status: ['draft', 'in_review', 'approved'],
      formula_status: ['draft', 'in_review', 'published'],
      lab_kind: ['physics', 'geometry2d', 'geometry3d'],
      legal_document_type: ['pd_processing', 'child_pd_processing', 'offer', 'terms'],
      link_status: ['active', 'revoked'],
      report_status: ['open', 'resolved', 'rejected'],
      task_type: [
        'single_choice',
        'multi_choice',
        'number',
        'formula',
        'cloze_word',
        'matching',
        'ordering',
      ],
      test_mode: ['practice', 'exam'],
      test_scope: ['topic', 'section', 'quarter', 'grade', 'subject'],
    },
  },
} as const;

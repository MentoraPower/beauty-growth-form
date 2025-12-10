export interface Pipeline {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  created_at?: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  country_code: string;
  instagram: string;
  service_area: string;
  monthly_billing: string;
  weekly_attendance: string;
  workspace_type: string;
  years_experience: string;
  pipeline_id: string | null;
  ordem: number;
  created_at: string;
}

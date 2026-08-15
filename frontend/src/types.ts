export type TabId = 'overview' | 'transactions' | 'budgets' | 'insights' | 'settings' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  monthly_income: number;
  profession?: string;
  consent_given: boolean;
  consent_date: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  transaction_date: string;
  description: string;
  type: string;
  source: string;
  confidence_score: number;
  is_flagged: boolean;
  category: Category | null;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  limit_amount: number;
  month: number;
  year: number;
  category: Category | null;
  spent_amount: number;
  percent_used: number;
  is_breached: boolean;
}

export interface Insight {
  id: string;
  user_id: string;
  insight_type: 'alert' | 'trend' | 'recommendation';
  message: string;
  related_category_id: string | null;
  is_read: boolean;
  created_at: string;
  category: Category | null;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  status: string;
  transaction_count: number;
}

export interface AdminUserListResponse {
  total: number;
  skip: number;
  limit: number;
  users: AdminUser[];
}

export interface AdminMlMetrics {
  train_samples: number | null;
  validation_samples: number | null;
  test_samples: number | null;
  train_accuracy: number | null;
  validation_accuracy: number | null;
  test_accuracy: number | null;
  total_training_corpus_size: number | null;
  trained_at: string | null;
  model_file_timestamp: string | null;
  model_file_size_bytes: number | null;
}

export interface MlStats {
  default_samples: number;
  user_samples: number;
  total_samples: number;
  last_trained?: string;
}

export interface MlTrainResponse {
  status: string;
  default_samples: number;
  user_samples: number;
  total_samples: number;
  message: string;
}

export interface CSVImportResponse {
  message: string;
  total_parsed: number;
  total_imported: number;
}

export interface MessageResponse {
  message: string;
}

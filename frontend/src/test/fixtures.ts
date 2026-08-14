export const baseUser = {
  id: 'user-1',
  email: 'jide@naira.ai',
  full_name: 'Babajide Alao',
  monthly_income: 450000,
  profession: 'Engineer',
  consent_given: true,
  consent_date: '2026-01-01T00:00:00Z',
  is_admin: false,
  created_at: '2026-01-01T00:00:00Z',
};

export const adminUser = { ...baseUser, id: 'admin-1', email: 'admin@naira.ai', is_admin: true };

export const categories = [
  { id: 'cat-food', name: 'Food & Groceries', type: 'expense', is_default: true },
  { id: 'cat-transport', name: 'Transport (Danfo, Uber, Keke)', type: 'expense', is_default: true },
  { id: 'cat-salary', name: 'Salary', type: 'income', is_default: true },
];

export function makeTransaction(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    user_id: baseUser.id,
    category_id: 'cat-food',
    amount: 5000,
    transaction_date: '2026-07-01',
    description: 'Test transaction',
    type: 'expense',
    source: 'manual',
    confidence_score: 1,
    is_flagged: false,
    category: categories[0],
    ...overrides,
  };
}

export function makeBudget(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: `budget-${Math.random().toString(36).slice(2, 8)}`,
    user_id: baseUser.id,
    category_id: 'cat-food',
    limit_amount: 50000,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    category: categories[0],
    spent_amount: 0,
    percent_used: 0,
    is_breached: false,
    ...overrides,
  };
}

export const adminMlMetrics = {
  train_samples: 98,
  validation_samples: 21,
  test_samples: 22,
  train_accuracy: 0.9898,
  validation_accuracy: 0.619,
  test_accuracy: 0.5909,
  total_training_corpus_size: 141,
  trained_at: '2026-08-14T15:21:00Z',
  model_file_timestamp: '2026-08-14T15:21:00Z',
  model_file_size_bytes: 121_500,
};

export function makeAdminUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: `admin-user-${Math.random().toString(36).slice(2, 8)}`,
    email: 'someone@nairaai-test.com',
    full_name: 'Some User',
    created_at: '2026-01-01T00:00:00Z',
    status: 'active',
    transaction_count: 0,
    ...overrides,
  };
}

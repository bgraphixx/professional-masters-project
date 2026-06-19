
## Database Schema

### Users
- id (UUID)
- email
- password_hash
- full_name
- monthly_income
- consent_given
- consent_date
- created_at

### Categories
- id
- name
- type (income/expense)
- is_default

### Transactions
- id
- user_id
- category_id
- amount
- transaction_date
- description
- type
- source (manual/csv)
- confidence_score
- is_flagged

### Budgets
- id
- user_id
- category_id
- limit_amount
- month
- year

### Insights
- id
- user_id
- insight_type (alert/trend/recommendation)
- message
- related_category_id
- is_read

---

## API Design

### Auth
POST /auth/register  
POST /auth/login  

### Transactions
GET /transactions  
POST /transactions  
PUT /transactions/{id}  
DELETE /transactions/{id}  

POST /transactions/import-csv  

### Budgets
GET /budgets  
POST /budgets  
PUT /budgets/{id}  

### Insights
GET /insights  
PATCH /insights/{id}/read  

### ML
POST /ml/categorise  

---

## Machine Learning Module

### Input
Transaction description text

### Output
Category + confidence score

### Pipeline
1. Clean text
2. TF-IDF vectorisation
3. Classification (LogReg / Naive Bayes)
4. Confidence scoring
5. Fallback rule-based mapping

### Categories (Example)
- Food & Groceries
- Transport (Danfo, Uber, Keke)
- Airtime & Data
- Utilities
- Rent
- Salary
- Business Income

---

## AI Insights Engine

### Logic Types

#### 1. Budget Alerts
- If spend > 80% → warning
- If spend > 100% → alert

#### 2. Trend Analysis
- Month-over-month spending changes
- Category spikes

#### 3. Recommendations
- Reduce overspending categories
- Suggest savings % based on income

#### 4. Anomaly Detection
- Sudden large expenses
- Irregular spending patterns

---

## Non-Functional Requirements

### Performance
- API response < 2s
- Dashboard load < 3s

### Security
- bcrypt password hashing
- JWT authentication
- HTTPS enforced
- AES encryption (at rest)

### Compliance
- NDPA (2023)
- Consent tracking
- Right to erasure

---

## Development Roadmap (Agile Sprints)

### Sprint 1
- Project setup
- Auth system
- DB schema

### Sprint 2
- Transactions CRUD
- CSV import

### Sprint 3
- Dashboard UI
- Charts

### Sprint 4
- ML model training
- Categorisation API

### Sprint 5
- Insights engine
- Recommendations logic

### Sprint 6
- Testing
- Optimisation
- Deployment

---

## Deployment

### Local
```bash
docker-compose up --build
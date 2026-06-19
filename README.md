# Personal Finance Tracker with AI-Powered Budgeting Insights

## Overview
A full-stack web application that enables users to track income and expenses, automatically categorise transactions using NLP, and receive AI-powered personalised budgeting recommendations.

The system is designed specifically for Nigerian users, with Naira-based accounting, local spending categories, and privacy compliance aligned with NDPA (2023).

---

## Core Features

### 1. Authentication & User Management
- User registration (email + password)
- JWT-based authentication
- NDPA consent capture
- Profile management
- Account deletion (soft delete)

### 2. Transaction Management
- Add income/expense manually
- Edit/delete transactions
- CSV import (bank statements)
- Automatic categorisation via ML model
- Flag low-confidence predictions

### 3. Budgeting System
- Create monthly budgets per category
- Track actual vs budget
- Alerts for overspending

### 4. AI Insights Engine
- Spending pattern analysis
- Budget recommendations
- Savings suggestions
- Anomaly detection

### 5. Dashboard
- Income vs expense chart
- Category breakdown (pie/donut)
- Savings trend line
- Budget utilisation bars
- Insights feed

---

## Tech Stack

### Frontend
- React.js (Vite)
- TypeScript
- Recharts (data visualisation)
- TailwindCSS (UI)

### Backend
- Python
- FastAPI
- Pydantic
- JWT Auth

### Machine Learning
- Scikit-learn
- TF-IDF Vectorizer
- Logistic Regression / Naive Bayes
- Joblib (model persistence)

### Database
- PostgreSQL
- SQLAlchemy ORM
- Alembic (migrations)

### DevOps
- Docker
- Docker Compose
- GitHub Actions (CI/CD)

---

## System Architecture

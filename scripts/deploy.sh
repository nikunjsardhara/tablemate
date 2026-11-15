#!/usr/bin/env bash
# Tablemate → Google Cloud Run + Cloud SQL
#
# Prerequisites (run once, interactively):
#   gcloud auth login
#   gcloud config set project <PROJECT_ID>
#   ./scripts/deploy.sh setup      # enables APIs, creates Cloud SQL, schema
#   ./scripts/deploy.sh deploy     # builds + deploys Cloud Run
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT_ID:?Set GOOGLE_CLOUD_PROJECT_ID}"
REGION="${REGION:-us-central1}"
INSTANCE="${INSTANCE:-tablemate-db}"
DATABASE="${DATABASE:-tablemate}"
SERVICE="${SERVICE:-tablemate}"

DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD (used for the Cloud SQL user)}"
CONNECTION_NAME="$PROJECT_ID:$REGION:$INSTANCE"

# DATABASE_URL over the Cloud Run unix socket — no TLS handshake to negotiate.
DATABASE_URL="postgresql://app:${DB_PASSWORD}@/${DATABASE}?host=/cloudsql/${CONNECTION_NAME}"

case "${1:-help}" in
  setup)
    gcloud services enable run.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com

    if ! gcloud sql instances describe "$INSTANCE" --format="value(name)" 2>/dev/null; then
      echo "→ Creating Cloud SQL instance (takes ~5-10 min)…"
      gcloud sql instances create "$INSTANCE" \
        --database-version=POSTGRES_16 \
        --edition=ENTERPRISE \
        --tier=db-custom-1-3840 \
        --region="$REGION" \
        --storage-auto-increase
    fi

    gcloud sql databases create "$DATABASE" --instance="$INSTANCE" 2>/dev/null || echo "database exists"

    if ! gcloud sql users describe app --instance="$INSTANCE" --format="value(name)" 2>/dev/null; then
      gcloud sql users create app --instance="$INSTANCE" --password="$DB_PASSWORD"
    fi

    echo "→ Applying schema through the Auth Proxy…"
    # cloud-sql-proxy PROJECT:REGION:INSTANCE --port 5432 &
    # psql "postgresql://app:${DB_PASSWORD}@127.0.0.1:5432/${DATABASE}" -f init.sql
    echo "   (manual step: run init.sql through cloud-sql-proxy — see README)"
    ;;

  deploy)
    gcloud run deploy "$SERVICE" \
      --source . \
      --region "$REGION" \
      --allow-unauthenticated \
      --add-cloudsql-instances "$CONNECTION_NAME" \
      --set-env-vars "DATABASE_URL=${DATABASE_URL},DATABASE_SSL=false,GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.8-flash},NODE_ENV=production" \
      --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
      --min-instances 0 \
      --cpu 1 --memory 512Mi
    ;;

  *)
    echo "usage: ./scripts/deploy.sh [setup|deploy]"
    ;;
esac

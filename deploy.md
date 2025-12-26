cd infra
terraform apply

cd ../backend/
gcloud builds submit --tag us-central1-docker.pkg.dev/balloon-87473/backend-repo/stats-api .

gcloud run deploy stats-api --image us-central1-docker.pkg.dev/balloon-87473/backend-repo/stats-api --platform managed --region us-central1 --allow-unauthenticated --service-account stats-api-sa@balloon-87473.iam.gserviceaccount.com --set-env-vars PROJECT_ID=balloon-87473,ADMIN_EMAIL=hejustino@hjdconsulting.ca

cd ..1
npm run build
npx firebase deploy --only hosting --project balloon-87473


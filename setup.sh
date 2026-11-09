#!/bin/bash
# Autorise le robot GitHub (ouassimno/Ralass) à envoyer les notifs Firebase — sans clé secrète
P=ralass
N=$(gcloud projects describe $P --format='value(projectNumber)')
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com iam.googleapis.com --project $P
gcloud iam workload-identity-pools create github --location=global --display-name=GitHub --project $P
gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='ouassimno/Ralass'" --project $P
SA=$(gcloud iam service-accounts list --project $P --filter="email~firebase-adminsdk" --format='value(email)')
gcloud iam service-accounts add-iam-policy-binding "$SA" --project $P --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$N/locations/global/workloadIdentityPools/github/attribute.repository/ouassimno/Ralass" >/dev/null
echo; echo "RESULTAT: N=$N SA=$SA"

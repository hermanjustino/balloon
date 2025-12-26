provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ============================================================================
# FIREBASE MODULE
# Handles: Firebase APIs, Firestore, Auth, Hosting
# ============================================================================
module "firebase" {
  source = "./modules/firebase"
  
  project_id          = var.project_id
  admin_email         = var.admin_email
  bigquery_dataset_id = module.bigquery.dataset_id
  
  depends_on = [module.bigquery]
}

# ============================================================================
# BIGQUERY MODULE
# Handles: BigQuery dataset for SQL analytics
# ============================================================================
module "bigquery" {
  source = "./modules/bigquery"
  
  project_id  = var.project_id
  admin_email = var.admin_email
}



# ============================================================================
# DOMAIN MODULE (OPTIONAL)
# Handles: Domain registration, DNS, Firebase Hosting custom domain
# Uncomment and configure variables to enable
# ============================================================================
# module "domain" {
#   source = "./modules/domain"
#   
#   project_id               = var.project_id
#   domain_name              = var.domain_name
#   contact_email            = var.contact_email
#   contact_phone            = var.contact_phone
#   contact_zip              = var.contact_zip
#   firebase_hosting_site_id = module.firebase.hosting_site_id
# }
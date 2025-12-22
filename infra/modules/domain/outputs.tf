output "dns_name_servers" {
  description = "DNS name servers for domain configuration"
  value       = google_dns_managed_zone.main.name_servers
}

output "domain_name" {
  description = "Registered domain name"
  value       = google_clouddomains_registration.main.domain_name
}

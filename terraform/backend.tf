terraform {
  backend "gcs" {
    # Configured via CLI:
    # tofu init -backend-config="bucket=eulard-tfstate-kelihi-ai-platform" \
    #           -backend-config="prefix=eulard/dev"
  }
}

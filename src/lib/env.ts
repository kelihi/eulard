export function validateEnv() {
  // DB_HOST/DB_PORT are not required when using Cloud SQL Auth Proxy (INSTANCE_CONNECTION_NAME)
  const hasCloudSqlProxy = !!process.env.INSTANCE_CONNECTION_NAME;
  const required = [
    ...(!hasCloudSqlProxy ? ['DB_HOST', 'DB_PORT'] : []),
    'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'NEXTAUTH_SECRET',
  ];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

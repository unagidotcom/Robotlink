# Disposable Neon database for B1 verification

Use a brand-new Neon project dedicated to testing, or an empty branch inside an existing non-production test project. Do not branch from production data.

1. Sign in to the Neon Console and create a project named `article-seo-b1-verification`.
2. Keep the default empty `neondb` database, or create an empty branch named `test/b1-verification`.
3. Open **Connection Details**, select a read/write connection, and copy its PostgreSQL URI. Neon requires TLS; retain its supplied TLS parameters.
4. In a fresh PowerShell window in this repository, capture the URI without placing it in shell history:

```powershell
$secureDatabaseUrl = Read-Host "Paste the disposable Neon URI" -AsSecureString
$databasePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureDatabaseUrl)
try {
  $env:TEST_DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($databasePointer)
  $env:DATABASE_URL = $env:TEST_DATABASE_URL
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($databasePointer)
  Remove-Variable secureDatabaseUrl
}
$env:RUN_DATABASE_INTEGRATION = "true"
```

Do not echo either variable and do not save the URI to a tracked file.

5. Apply and verify the migrations:

```powershell
npm run db:deploy
npm run db:generate
npx prisma migrate status
npm run db:deploy
```

The second deploy must report no pending migrations.

6. Run the real PostgreSQL integration suite and the regression suite:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

7. Clear the process variables after testing:

```powershell
Remove-Item Env:TEST_DATABASE_URL
Remove-Item Env:DATABASE_URL
Remove-Item Env:RUN_DATABASE_INTEGRATION
```

8. Delete the Neon test branch or entire dedicated test project after results are recorded.

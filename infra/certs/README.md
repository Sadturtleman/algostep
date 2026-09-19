# Supabase PostgreSQL CA

`supabase-ca.crt` is a public CA certificate, not a private key.

Source: the project's Database → Settings → SSL configuration → Download certificate link:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Downloaded 2026-09-19. SHA256: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.

The server uses it only for PostgreSQL TLS with `rejectUnauthorized: true`. Certificate and hostname validation remain enabled. Replace from the official dashboard if Supabase rotates its CA; never disable validation to work around a connection error.

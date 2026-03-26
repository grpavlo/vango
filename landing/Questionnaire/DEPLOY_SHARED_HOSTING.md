# VanGo Deployment (Shared Hosting, PHP + MySQL)

## 1) Build frontend locally

```bash
npm ci
npm run build
```

Result: static files in `dist/`.

## 2) Prepare MySQL on hosting

1. Create database and user in hosting panel.
2. Open `phpMyAdmin`.
3. Import schema file: `api/sql/schema.sql`.

## 3) Configure backend

1. Copy `api/config.local.example.php` -> `api/config.local.php`.
2. Fill DB credentials.
3. Generate admin password hash:

```bash
php -r "echo password_hash('YOUR_ADMIN_PASSWORD', PASSWORD_DEFAULT), PHP_EOL;"
```

4. Put generated hash into `admin.password_hash`.
5. Keep `session.secure_cookie = true` for HTTPS.
6. Optionally set GeoIP provider in `geoip.url_template`.

## 4) Upload files to web-root

Upload:

- contents of `dist/` (not the folder itself, but files inside)
- `api/` folder
- `.htaccess`

Final structure in web-root should look like:

```text
/
  index.html
  assets/...
  robots.txt
  sitemap.xml
  .htaccess
  api/
    index.php
    bootstrap.php
    config.php
    config.local.php
    sql/schema.sql
```

## 5) Configure domain + SSL

1. Point `vango.com.ua` and `www.vango.com.ua` to hosting.
2. Install SSL certificate (cert + key + CA bundle) in panel.
3. Ensure HTTPS opens successfully.
4. `.htaccess` already redirects `www` and `http` -> `https://vango.com.ua`.

## 6) Smoke checks

1. Open `https://vango.com.ua/`.
2. Complete survey and verify row in `survey_responses`.
3. Open `https://vango.com.ua/admin`:
   - wrong password -> 401-style error
   - correct password -> dashboard loads
4. Check:
   - `https://vango.com.ua/robots.txt`
   - `https://vango.com.ua/sitemap.xml`
   - `https://www.vango.com.ua` redirects to `https://vango.com.ua`

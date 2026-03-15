# Web User App

## Status

The user-facing client now runs as a Web app.

- User app entry: `http://localhost:3001/app`
- Backend API base: `http://localhost:3001/api/web`
- Admin login: `http://localhost:3001/login`

The old `uniapp-project/` folder is still present as archive/reference only.
It is no longer required for the user-side runtime.

## Start

From the repo root:

```bash
npm run start:web
```

Or from the admin folder:

```bash
cd admin
node server.js
```

## User Login

Current Web login uses `account + password`.

Examples:

- `seller-002 / user123`
- `seller-003 / user123`
- `buyer-demo-001 / user123`

Notes:

- Old seeded test users use the default password `user123`
- If an entered account does not exist yet, the system creates a normal user on first login
- Admin and customer-service accounts should continue using `http://localhost:3001/login`

## Supported User Flows

- Login
- District list
- Listing feed
- Listing detail
- Create sale/wanted listing
- Open conversation
- Send and view messages
- View my listings

## Main Files

- `admin/routes/web-api.js`
- `admin/public/user-web/index.html`
- `admin/public/user-web/app.js`
- `admin/public/user-web/styles.css`
- `admin/server.js`

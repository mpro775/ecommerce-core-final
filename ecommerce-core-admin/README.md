# General Ecommerce Admin Dashboard

Admin dashboard for the General Ecommerce Platform.

## Tech Stack

- **Framework:** React 19
- **Build Tool:** Vite 6
- **UI Library:** MUI (Material UI) 7
- **Charts:** Recharts
- **Maps:** Leaflet + React Leaflet
- **RTL Support:** Stylis RTL Plugin
- **Fonts:** Cairo, Tajawal (Arabic)

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (port 5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Lint source code |

## Environment Variables

```
VITE_API_BASE_URL=http://localhost:3000
VITE_SF_VISUAL_BUILDER_ENABLED=true
VITE_SF_ROLLOUT_STAGE=beta
```

## Features

### Merchant Dashboard
- Product & catalog management
- Order management
- Customer management
- Shipping configuration
- Marketing & promotions
- Analytics & reporting
- Store settings & onboarding

### Platform Console
- Multi-tenant store management
- Platform-level analytics
- Subscription & billing
- Support tickets

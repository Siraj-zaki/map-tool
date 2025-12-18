# Harterbrocken Trail Map

Full-stack Node.js + React application for managing and displaying hiking/MTB trail routes.

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Run both server and client in development
npm run dev
```

## Project Structure

```
├── server/          # Node.js + Express + SQLite backend
│   ├── src/
│   │   ├── index.ts       # Express server
│   │   ├── db.ts          # SQLite database
│   │   └── routes/        # API endpoints
│   └── package.json
├── client/          # React + Vite + Mapbox GL frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   └── api/           # API client
│   └── package.json
└── package.json     # Root package.json
```

## URLs

- **Frontend**: http://localhost:5173 (or 5174)
- **Backend API**: http://localhost:3001
- **Admin Login**: admin / admin123

## Features

1. ✅ Multilingual (DE/EN)
2. ✅ Elevation Profile with zoom controls
3. ✅ Route grouping for iFrame
4. ✅ Bidirectional map ↔ elevation sync
5. ✅ GPX Download (Gold/Silver/Bronze stages)
6. ✅ Stage markers
7. ✅ Mapbox GL styling
8. ✅ Weather widget
9. ⏳ Performance optimization
10. ✅ Fullscreen mode

## Embed in Shopify

```html
<iframe
  src="https://your-domain.com/route/1"
  width="100%"
  height="700"
  frameborder="0"
></iframe>
```

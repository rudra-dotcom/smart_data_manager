# Smart Data Manager (MERN + SQLite)

Local inventory manager with dynamic autocomplete, full CRUD, and a global RMB → INR exchange rate that cascades price updates.

## Tech Stack
- Backend: Node.js, Express, better-sqlite3, dotenv, CORS
- Frontend: React (Vite), Axios, TailwindCSS
- Database: SQLite (auto-created at `backend/inventory.db`)

## Setup
1) Backend
```bash
cd backend
npm install
npm run dev   # or: npm start
```
- Env (optional): `PORT=5000`, `CLIENT_ORIGIN=http://localhost:5173`
  - For chat-to-SQL via Groq, set `GROQ_API_KEY` (see `backend/.env.example`).

2) Frontend
```bash
cd frontend
npm install
npm run dev   # starts Vite on 5173
```
- Env (optional): create `frontend/.env` with `VITE_API_URL=http://localhost:5000`

## API Endpoints
- `POST   /api/items` – create item
- `GET    /api/items` – list all
- `GET    /api/items/:id` – fetch one
- `PUT    /api/items/:id` – update
- `DELETE /api/items/:id` – delete
- `GET    /api/items/search?query=text` – partial match autocomplete
- `GET    /api/exchange-rate` – current rate
- `PUT    /api/exchange-rate` – update rate and recalc all price fields (ppp/retail_price/ws_price = ch_price * rate)

## Sample SQL Schema
```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT,
  quality TEXT,
  ch_price REAL DEFAULT 0,
  caring TEXT,
  ppp REAL,
  retail_price REAL,
  ws_price REAL,
  quantity INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value REAL
);
-- Seed: INSERT OR REPLACE INTO settings(key, value) VALUES ('exchange_rate', 1);
```

## Example JSON
- Create
```json
POST /api/items
{
  "name": "Leather Tote",
  "brand": "Everpro",
  "quality": "A",
  "ch_price": 120,
  "caring": "Keep dry",
  "ppp": 1320,
  "retail_price": 1400,
  "ws_price": 1350,
  "quantity": 10
}
```
- Search
```json
GET /api/items/search?query=leat
[
  {
    "id": 1,
    "name": "Leather Tote",
    "brand": "Everpro",
    "quality": "A",
    "ch_price": 120,
    "caring": "Keep dry",
    "ppp": 1320,
    "retail_price": 1400,
    "ws_price": 1350,
    "quantity": 10,
    "created_at": "2024-06-01 12:30:00"
  }
]
```
- Update
```json
PUT /api/items/1
{ "quantity": 14, "ws_price": 1325 }
```
- Exchange rate update
```json
PUT /api/exchange-rate
{ "exchange_rate": 11.5 }
# All items ppp/retail_price/ws_price become ch_price * 11.5
```

## Frontend Features
- Autocomplete search that fetches live suggestions and auto-fills the form.
- Add/update form with all item fields.
- Exchange-rate control that recalculates prices globally.
- Data table with edit/delete controls and manual refresh.

## Notes
- Database and schema are auto-created on backend start.
- Price defaults: when creating/updating without explicit `ppp`, `retail_price`, or `ws_price`, the API computes them as `ch_price * exchange_rate`.
- The project ships without seeded items; add via UI or POST requests.

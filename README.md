# ArtiSoul

A local-artisan marketplace: makers open a shop in about a minute, buyers see
what's handmade within walking distance of wherever they're standing.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | MySQL schema (`Users`, `Shops`, `Products`) | done |
| 2 | Express + MySQL REST API | done |
| 3 | React + Vite + Tailwind responsive frontend | done |

## Repository layout

```
ArtiSoul/
├── package.json            # backend (Phase 2)
├── .env.example
├── src/                    # Express API
│   ├── server.js               # entry point
│   ├── app.js                  # express app, CORS, static /uploads, routes
│   ├── config/db.js            # mysql2 connection pool
│   ├── middleware/
│   │   ├── auth.js             # verifyToken, requireRole
│   │   └── errorHandler.js
│   ├── controllers/
│   │   ├── authController.js   # register, login
│   │   ├── shopController.js   # createShop, getMyShops
│   │   └── productController.js# addProduct, getNearbyProducts, ...
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── shopRoutes.js
│   │   ├── productRoutes.js
│   │   └── uploadRoutes.js     # multer product-photo upload
│   └── utils/asyncHandler.js
├── uploads/                # product photos (git-ignored, created on first upload)
└── frontend/               # React app (Phase 3)
    ├── index.html
    ├── tailwind.config.js
    ├── .env.example
    └── src/
        ├── App.jsx             # routes + responsive shell
        ├── index.css           # Tailwind layers + component classes
        ├── lib/
        │   ├── api.js          # every backend call lives here
        │   ├── format.js       # ₹ / distance formatting
        │   └── useGeolocation.js
        ├── context/AuthContext.jsx
        ├── components/         # AppShell, SideNav, BottomNav, ProductCard, …
        └── pages/
            ├── Welcome.jsx
            ├── Login.jsx  Signup.jsx
            ├── Feed.jsx        # customer feed
            ├── ProductDetail.jsx
            ├── Dashboard.jsx   # artisan dashboard
            ├── CreateShop.jsx
            ├── AddProduct.jsx  # photo upload + product details
            └── Account.jsx
```

---

## Running it

Two terminals. Backend first.

### 1. Backend (port 5000)

Run `artisoul_phase1_schema.sql` against MySQL, then: (recommended using MySQL Workbench)


```bash
npm install
cp .env.example .env   # fill in DB credentials + a JWT_SECRET (or recommended copy the content in .env directly from .env.example and change password and string)

npm run dev
```

### 2. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The frontend defaults to `http://localhost:5000`;
override with `VITE_API_URL` in `frontend/.env` if the backend runs elsewhere.

> `CORS_ORIGIN` in the backend `.env` must include the frontend's origin, or the
> browser will block every request. It defaults to allowing any origin when unset.

---

## Phase 3 — the frontend

Built with **Vite + React 19 + Tailwind CSS**, responsive from a 320 px phone up
to a wide monitor. One codebase, three layouts:

| Width | Navigation | Feed |
| --- | --- | --- |
| < 640 px (phone) | bottom tab bar | one card per row |
| 640–1023 px (tablet) | bottom tab bar | fluid grid, 2 across |
| >= 1024 px (laptop) | persistent left sidebar | fluid grid, 3–4 across |

The product grid uses `repeat(auto-fill, minmax(...))` rather than fixed
breakpoints, so it reflows to whatever width is actually available instead of
guessing — including when the sidebar appears and takes 264 px away from it.
Auth screens become a two-column split at `lg`, and the product page puts the
photo beside the details instead of above them.

### Screens

| Route | Screen | Who |
| --- | --- | --- |
| `/` | Welcome — pitch, role entry points | anyone |
| `/signup` | Signup with an artisan / customer toggle | anyone |
| `/login` | Login | anyone |
| `/feed` | **Customer feed** — scrollable product cards, nearest first | anyone |
| `/product/:id` | Product detail + maker's location | anyone |
| `/artisan` | **Artisan dashboard** — stats, shop, listings | artisan |
| `/artisan/shop` | Open a shop (GPS pin or manual lat/lng) | artisan |
| `/artisan/add` | **Add a product** — photo upload, name, price, category | artisan |
| `/account` | Profile, API status, log out | anyone |

### Notes on the frontend

- **Browsing needs no account.** `GET /api/products/nearby` is public in Phase 2,
  so the feed is too — a buyer only signs in if they want to sell.
- **Location.** The feed asks the browser for GPS and falls back to Pune
  (18.5204, 73.8567) if permission is denied, so it never renders empty for the
  wrong reason. The radius chips (1–25 km) drive the Haversine query.
- **Category and search filter client-side.** Only location and radius hit the
  network, so tapping a category chip is instant. The backend's `?category=`
  filter is still wired up in `lib/api.js`.
- **Auth** is a JWT in `localStorage`, read through `AuthContext`. `ProtectedRoute`
  gates the artisan screens by `role`, mirroring the backend's `requireRole`.
- **All API access goes through `lib/api.js`**, which unwraps the `{ success, data }`
  envelope and turns a failed fetch into a readable message instead of a stack trace.
- **No second CSS framework.** Tailwind's breakpoints cover every layout here;
  adding Bootstrap alongside it would mean two resets and two grid systems
  fighting over the same elements.

---

## Endpoints

### Required by the Phase 2 spec

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | none | Register artisan or customer |
| POST | `/api/products/add` | artisan | Add a product to your shop |
| GET | `/api/products/nearby` | none | Products within N km (Haversine) |

### Extra convenience routes

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | none | Get a JWT to use the protected routes |
| POST | `/api/shops/create` | artisan | Create your shop (needed before adding products) |
| GET | `/api/shops/mine` | artisan | List your own shop(s) |
| GET | `/api/products/:id` | none | Single product detail |
| GET | `/api/products/shop/:shop_id` | none | All products for one shop |
| POST | `/api/uploads/image` | artisan | Upload a product photo, returns its URL |
| GET | `/api/health` | none | Uptime check |

### Example flow (curl)

```bash
# 1. Register as an artisan
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"role":"artisan","name":"Meera Kulkarni","phone":"9876543210","password":"secret123"}'
# -> returns { data: { token, user } }

# 2. Create a shop (use the token from step 1)
curl -X POST http://localhost:5000/api/shops/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"shop_name":"Meeras Handloom Studio","latitude":18.52043,"longitude":73.85674,"address":"FC Road, Pune"}'

# 3. Upload a photo (optional) — returns { data: { image_url } }
curl -X POST http://localhost:5000/api/uploads/image \
  -H "Authorization: Bearer <TOKEN>" \
  -F "image=@saree.jpg"

# 4. Add a product (use shop_id from step 2)
curl -X POST http://localhost:5000/api/products/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"shop_id":1,"name":"Handwoven Cotton Saree","price":2499,"category":"Textiles"}'

# 5. Customer discovers nearby products — no login needed
curl "http://localhost:5000/api/products/nearby?lat=18.53&lng=73.85&radius=5"
```

---

## Notes / design decisions

- Passwords are hashed with bcrypt before storage — the schema's comment is respected.
- JWT (`role` + `user_id` in the payload) gates `POST /products/add` and the shop
  routes so only artisans can create shops/products, and only in their own shop.
- `GET /products/nearby` reuses the exact Haversine formula already sketched in the
  schema file's bonus section, wired to real `lat` / `lng` / `radius` / `category`
  query params.
- Centralized error handler + `asyncHandler` wrapper keep controllers free of
  repetitive try/catch blocks and turn MySQL error codes into clean HTTP responses.
- **Photo uploads** are stored on disk under `uploads/` and served statically.
  Filenames are randomised so two artisans uploading `saree.jpg` don't collide.
  Only images are accepted, capped at 5 MB. Swapping in S3 or Cloudinary later
  touches only `src/routes/uploadRoutes.js`.
- **CORS** is an allow-list read from `CORS_ORIGIN`, not a blanket `*`, so the
  deployed API can be locked to the deployed frontend.

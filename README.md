# ArtiSoul

## Deploy on Cloudflare

The whole app (frontend + API + uploads) runs as one Cloudflare Worker.
From PowerShell in the repo root: `npm run cf:setup` once, then
`npm run cf:deploy` for updates. Full guide: [CLOUDFLARE.md](CLOUDFLARE.md).

## Quick start for phone / public testing (Cloudflare tunnels)

```bash
cloudflared tunnel --url http://localhost:5000
cloudflared tunnel --url http://localhost:5173
```

Run each in its own terminal, alongside `npm run dev`. The camera, AR and
payment pop-up only work over **HTTPS**, so open the app on your phone through
the tunnel address of the `5173` command. Details are in
[Tunnel & HTTPS setup](#10-tunnel--https-setup) below.

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
| GET | `/api/chat/conversations` | JWT | List the signed-in user's conversations |
| POST | `/api/chat/shops/:shopId/conversation` | JWT | Open or reuse a shop conversation |
| GET | `/api/chat/conversations/:id/messages` | JWT | Read messages in a conversation |
| POST | `/api/chat/conversations/:id/messages` | JWT | Send a message |
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

# 6. Apply the chat migration before using the chat window
mysql -u root -p artisoul < artisoul_phase5_chat.sql
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

---

# Change log — features added after Phase 3 (in order)

Backend code lives in `backend/`, frontend in `frontend/`. Every database change
is a numbered SQL file in `backend/`; **run them in order** (they are
already applied on the development database).

| # | Migration file | Adds |
| --- | --- | --- |
| 4 | `artisoul_phase4_orders.sql` | `Orders` table |
| 5 | `artisoul_phase5_chat.sql` | chat tables |
| 6 | `artisoul_phase6_payments.sql` | payment + delivery columns on `Orders` |
| 7 | `artisoul_phase7_media.sql` | `ProductMedia` table |
| 8 | `artisoul_phase8_360.sql` | `Products.view360_enabled`, `Product360` table |
| 9 | `artisoul_phase9_glb.sql` | `Products.model_url` |
| 10 | `artisoul_phase10_stock.sql` | `Products.stock_quantity` |

## 1. Checkout page and payments (Collect for Delivery + UPI via Razorpay)

**What it does.** **Buy Now** on a product opens `/checkout/:id` instead of
placing the order instantly. The customer sees an order summary (with a quantity
selector), enters name, phone and delivery address, chooses a payment method and
confirms.

- **Collect for Delivery (COD):** the order is created straight away; the customer
  pays cash on arrival.
- **UPI / Online:** the order is created, a Razorpay order is opened, and the
  Razorpay Checkout pop-up handles UPI, cards and netbanking. After payment the
  server verifies Razorpay's signature before marking the order **Paid**.
- A customer who isn't logged in is sent to login first.

**Backend**
- `npm install razorpay` in `backend/`.
- Keys are read from `backend/.env`: `TEST_KEY_ID` and `TEST_KEY_SECRET`
  (Razorpay test keys). The secret never reaches the browser.
- `src/controllers/checkoutController.js`:
  - `POST /api/orders/checkout` — validates the input, creates the order and, for
    UPI, a Razorpay order (amount in paise). Returns the key id and Razorpay
    order id for the pop-up.
  - `POST /api/orders/verify-payment` — recomputes the HMAC-SHA256 signature of
    `razorpay_order_id|razorpay_payment_id` with the secret and compares it in
    constant time. Valid → `payment_status = 'Paid'`, otherwise `'Failed'`.
- `src/routes/orderRoutes.js` registers both routes (customer role only).
- Migration `artisoul_phase6_payments.sql` adds `payment_method`
  (`COD`/`UPI`), `payment_status` (`Pending`/`Paid`/`Failed`), `delivery_name`,
  `delivery_phone`, `delivery_address`, `razorpay_order_id`, `razorpay_payment_id`.

**Frontend**
- `src/pages/Checkout.jsx` (route added in `App.jsx`); the Razorpay script is
  loaded only when the customer pays online.
- `lib/api.js`: `api.orders.checkout` and `api.orders.verifyPayment`.
- `ProductDetail.jsx`: Buy Now now just navigates to the checkout. (An old
  "order placed" screen was removed from this file — leaving it caused a blank
  product page for a while.)

## 2. Product preview — photo and video gallery

**What it does.** Artisans can attach up to 8 extra photos or short videos to a
product; customers browse them in a viewer with thumbnails.

- **Backend:** `POST /api/uploads/media` (images up to 5 MB, MP4/WEBM up to
  30 MB), `ProductMedia` table (migration 7), and `GET /api/products/:id` now
  returns a `media` array.
- **Frontend:** `components/MediaGallery.jsx`; a "Preview gallery" field in the
  product form.

## 3. 360° photo view (per product, artisan-controlled)

**What it does.** The artisan can switch **Enable 360° view** on or off for each
product. When on, they upload photos from **front, right, back, left**
(required) and **top, bottom** (optional). Customers drag to turn the product;
neighbouring photos are cross-faded for a smooth turn, and dragging up/down tilts
toward the top/bottom photos.

> This is an image-blending viewer, **not** a deep-learning reconstruction. A
> model cannot reliably build true 3D from 4–6 photos (that needs dozens of
> overlapping shots) — for a true 3D object use the `.glb` option below.

- **Backend:** `Products.view360_enabled` + `Product360` table (migration 8);
  `addProduct`/`updateProduct` require the four side photos when it's enabled;
  `GET /api/products/:id` returns `views360`.
- **Frontend:** `components/Viewer360.jsx`; the toggle and six photo slots in
  the product form.
- Rotation speed was slowed, and it **never autoplays** (see item 4).

## 4. Customer chooses the preview mode (no autoplay)

Because the customer's device is unknown, nothing loads or plays automatically.
`components/PreviewPanel.jsx` shows a **"Preview this product"** row with a button
for each mode the artisan provided — **360° photos**, **3D model**,
**View in your room** and **Photos & videos**. Tapping a button opens that
mode; tapping it again closes it. In the 360° viewer a **Play** button starts
rotation.

## 5. 3D model (`.glb`)

**What it does.** The artisan uploads an optional `.glb` file (max 30 MB); the
customer can rotate and zoom it.

- **Backend:** `POST /api/uploads/model` (only `.glb`), `Products.model_url`
  (migration 9).
- **Frontend:** `npm install @google/model-viewer`; `components/ModelViewer.jsx`
  loads the library on demand. The product form has a "3D model (.glb)" field.
- Artisans can get a `.glb` by scanning the product with a phone app (Polycam,
  Luma AI) or exporting from Blender.

## 6. Edit and delete products, and stock quantity

**What it does.** Each product on the artisan dashboard has **Edit** and
**Delete** buttons and shows its stock count. The "Available / Sold out" toggle
was replaced by a **Quantity in stock** field.

- **Edit:** `/artisan/edit/:id` reuses the product form, pre-filled with the saved
  details, photo, gallery media, 360° photos and 3D model.
  `PUT /api/products/:id` (owner only).
- **Delete:** `DELETE /api/products/:id` (owner only). A product that already has
  orders **cannot** be deleted (it would erase order history); set its stock to
  0 instead.
- **Stock:** `Products.stock_quantity` (migration 10; existing in-stock items
  were set to 10). `stock_status` is derived: quantity 0 → `out_of_stock`.
  - `src/utils/stock.js` — `reserveStock` is a single atomic `UPDATE ... WHERE
    stock_quantity >= qty`, so two buyers can't oversell the last unit.
  - Both `POST /api/orders` and `POST /api/orders/checkout` reserve stock; an
    order for more than what's left is rejected (HTTP 409).
  - Stock is returned if the Razorpay order can't be started, and when an
    artisan marks an order **Cancelled**.
  - Checkout limits the quantity to the stock; the product page shows
    "Only N left" at 5 or fewer.
- Known gap: if a customer starts a UPI payment and abandons it, the units stay
  reserved until the artisan cancels that order.

## 7. "View in your room" (camera and AR)

Shown for products with a `.glb` model (`components/ModelViewer.jsx`):

- **View in your room (AR):** appears only on devices that support AR (Android
  with ARCore via Scene Viewer, iPhone/iPad via AR Quick Look). Places the
  product on the floor at real size. **Desktop browsers have no AR**, so the
  button is hidden there.
- **Use camera overlay:** works on any device with a camera. Opens the camera
  (only after the customer taps) and layers the 3D model over the live feed. The
  camera is released when turned off or when the viewer closes.
- Requires **HTTPS** (or `localhost`) — see item 10.

## 8. Uploaded files load on any device

Uploaded files used to be saved with links like `http://localhost:5000/uploads/...`,
which a phone can't open (on a phone, `localhost` is the phone). Now:

- `lib/api.js` rewrites any `/uploads/...` link in an API response to the
  current origin (`localiseUploads`), so old and new uploads load everywhere.
- The backend accepts `/uploads/...` paths when a product is saved
  (`productController.js`), so editing an old product keeps working.
- `app.set('trust proxy', true)` in `backend/src/app.js` makes new upload links
  use the public `https` host when behind the proxy/tunnel.

## 9. One address for frontend + API (Vite proxy)

`frontend/vite.config.js` proxies `/api` and `/uploads` to
`http://localhost:5000`, and `lib/api.js` now calls the page's own origin by
default (`VITE_API_URL` is optional). So a single tunnel to port 5173 carries
both the app and the API. `allowedHosts` must list the tunnel hostname.

## 10. Tunnel & HTTPS setup

Phones need an `https://` address for camera/AR (a LAN address such as
`http://192.168.x.x:5173` shows "camera needs a secure connection").

1. Start the app: `npm run dev` (backend on **5000**, Vite on **5173**).
   Don't start them twice, or the second copy fails with `EADDRINUSE`.
2. Start the tunnel(s):
   ```bash
   cloudflared tunnel --url http://localhost:5000
   cloudflared tunnel --url http://localhost:5173
   ```
   Because of the proxy in item 9, the **5173** tunnel is the one you open on
   the phone; the 5000 one is only needed if you want to reach the API directly.
3. Put the 5173 tunnel hostname in `allowedHosts` in `frontend/vite.config.js`
   and restart Vite.
4. Free quick tunnels get a **new address every time `cloudflared` restarts** —
   repeat step 3 and update `VITE_PUBLIC_URL` (item 11) when that happens.
5. Open the tunnel URL in Chrome/Safari (not inside WhatsApp/Instagram in-app
   browsers, which often block the camera).

## 11. "Open on your phone" QR code (desktop)

On a PC, **View in your room** shows a QR code (`qrcode` package) linking to the
same product page, so a customer can scan it and get real AR on their phone.

- The link uses `VITE_PUBLIC_URL` from `frontend/.env` (set to the tunnel's
  `https://` address) so it never encodes `http://localhost`.
- If it isn't set and the page is opened on `localhost`, the page warns that
  the QR won't work on a phone.
- `frontend/.env` is git-ignored. Example:
  ```
  VITE_PUBLIC_URL=https://your-tunnel.trycloudflare.com
  ```
  Restart `npm run dev` after editing it.

## New / changed API endpoints (summary)

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/orders/checkout` | customer | Create an order (COD or UPI) and reserve stock |
| POST | `/api/orders/verify-payment` | customer | Verify the Razorpay signature, mark Paid |
| PUT | `/api/products/:id` | artisan (owner) | Edit a product, its stock and extras |
| DELETE | `/api/products/:id` | artisan (owner) | Delete a product with no orders |
| POST | `/api/uploads/media` | artisan | Upload a gallery photo / video |
| POST | `/api/uploads/model` | artisan | Upload a `.glb` 3D model |

`POST /api/products/add` additionally accepts `stock_quantity`, `media`,
`view360_enabled`, `views` (`front/right/back/left/top/bottom` URLs) and
`model_url`; `GET /api/products/:id` additionally returns `stock_quantity`,
`media`, `views360`, `view360_enabled` and `model_url`.

## New environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `TEST_KEY_ID`, `TEST_KEY_SECRET` | Razorpay test keys |
| `frontend/.env` | `VITE_PUBLIC_URL` | Public https address used in the QR code |
| `frontend/.env` | `VITE_API_URL` | Optional; only if the API is on a different origin |

## New frontend files

`pages/Checkout.jsx`, `components/PreviewPanel.jsx`, `MediaGallery.jsx`,
`Viewer360.jsx`, `ModelViewer.jsx`. `AddProduct.jsx` now also serves as the edit
form, and `Dashboard.jsx` has Edit/Delete buttons.

# ArtiSoul — Phase 2 Backend

Express + MySQL API layer on top of your Phase 1 schema.

## File structure

```
artisoul-backend/
├── package.json
├── .env.example
└── src/
    ├── server.js              # entry point
    ├── app.js                 # express app + route mounting
    ├── config/
    │   └── db.js               # mysql2 connection pool
    ├── middleware/
    │   ├── auth.js             # verifyToken, requireRole
    │   └── errorHandler.js
    ├── controllers/
    │   ├── authController.js   # register, login
    │   ├── shopController.js   # createShop, getMyShops
    │   └── productController.js# addProduct, getNearbyProducts, ...
    ├── routes/
    │   ├── authRoutes.js
    │   ├── shopRoutes.js
    │   └── productRoutes.js
    └── utils/
        └── asyncHandler.js
```

## Setup

```bash
cd artisoul-backend
npm install
cp .env.example .env   # fill in your DB credentials + a JWT_SECRET
```

Run your `artisoul_phase1_schema.sql` against MySQL first, then:

```bash
npm run dev   # nodemon
# or
npm start
```

## Endpoints

### Required by Phase 2 spec

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | none | Register artisan or customer |
| POST | `/api/products/add` | artisan | Add a product to your shop |
| GET | `/api/products/nearby` | none | Products within N km (Haversine) |

### Extra convenience routes

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | none | Get a JWT to use the protected routes |
| POST | `/api/shops/create` | artisan | Create your shop (needed before adding products) |
| GET | `/api/shops/mine` | artisan | List your own shop(s) |
| GET | `/api/products/:id` | none | Single product detail |
| GET | `/api/products/shop/:shop_id` | none | All products for one shop |
| GET | `/api/health` | none | Uptime check |

## Example flow (curl)

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

# 3. Add a product (use shop_id from step 2)
curl -X POST http://localhost:5000/api/products/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"shop_id":1,"name":"Handwoven Cotton Saree","price":2499,"category":"Textiles"}'

# 4. Customer discovers nearby products — no login needed
curl "http://localhost:5000/api/products/nearby?lat=18.53&lng=73.85&radius=5"
```

## Notes / design decisions

- Passwords are hashed with bcrypt before storage — the schema's comment is respected.
- JWT (`role` + `user_id` in the payload) gates `POST /products/add` and shop routes so only artisans can create shops/products, and only for shops they own.
- `GET /products/nearby` reuses the exact Haversine formula already sketched in the schema file's bonus section, wired to real query params (`lat`, `lng`, optional `radius` default 5km, optional `category` filter).
- Centralized error handler + `asyncHandler` wrapper keep controllers free of repetitive try/catch blocks and turn MySQL errors (duplicate phone, bad foreign key) into clean JSON responses.

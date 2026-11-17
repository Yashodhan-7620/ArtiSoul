// Single place that knows how to talk to the Phase 2 Express API.
// Every call returns the parsed `data` field, or throws an Error carrying
// the backend's own message so screens can render it verbatim.

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

// Uploaded files are stored with whatever host served the upload (often
// http://localhost:5000, or an old tunnel address). Serving them from the
// current origin keeps them loading on phones and behind HTTPS.
const UPLOAD_URL = /^https?:\/\/[^/]+(\/uploads\/.+)$/;
function localiseUploads(value) {
  if (typeof value === 'string') return value.replace(UPLOAD_URL, `${BASE}$1`);
  if (Array.isArray(value)) return value.map(localiseUploads);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localiseUploads(v)]));
  }
  return value;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !form) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: form ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects on a genuine network failure — almost always
    // "the backend isn't running" during development.
    throw new ApiError(`Cannot reach the API at ${BASE}. Is the backend running?`, 0);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* some errors (413, proxy failures) come back without a JSON body */
  }

  if (!res.ok || payload?.success === false) {
    throw new ApiError(payload?.message || `Request failed (${res.status})`, res.status);
  }

  return localiseUploads(payload);
}

export const api = {
  health: () => request('/api/health'),

  auth: {
    register: (body) => request('/api/auth/register', { method: 'POST', body }),
    login: (body) => request('/api/auth/login', { method: 'POST', body }),
  },

  shops: {
    create: (body, token) => request('/api/shops/create', { method: 'POST', body, token }),
    mine: (token) => request('/api/shops/mine', { token }),
    // Shop details are final; a shop without a picture may add one, once.
    setImage: (shopId, image_url, token) =>
      request(`/api/shops/${shopId}/image`, { method: 'POST', body: { image_url }, token }),
  },

  products: {
    add: (body, token) => request('/api/products/add', { method: 'POST', body, token }),
    nearby: ({ lat, lng, radius = 5, category }) => {
      const qs = new URLSearchParams({ lat, lng, radius });
      if (category) qs.set('category', category);
      return request(`/api/products/nearby?${qs}`);
    },
    byId: (id) => request(`/api/products/${id}`),
    update: (id, body, token) => request(`/api/products/${id}`, { method: 'PUT', body, token }),
    remove: (id, token) => request(`/api/products/${id}`, { method: 'DELETE', token }),
    byShop: (shopId) => request(`/api/products/shop/${shopId}`),
    recommended: ({ lat, lng, productId, limit } = {}, token) => {
      const qs = new URLSearchParams();
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        qs.set('lat', lat);
        qs.set('lng', lng);
      }
      if (productId) qs.set('product_id', productId);
      if (limit) qs.set('limit', limit);
      return request(`/api/products/recommended?${qs}`, { token });
    },
  },

  uploads: {
    model: (file, token) => {
      const form = new FormData();
      form.append('model', file);
      return request('/api/uploads/model', { method: 'POST', body: form, token, form: true });
    },
    media: (file, token) => {
      const form = new FormData();
      form.append('media', file);
      return request('/api/uploads/media', { method: 'POST', body: form, token, form: true });
    },
    image: (file, token) => {
      const form = new FormData();
      form.append('image', file);
      return request('/api/uploads/image', { method: 'POST', body: form, token, form: true });
    },
  },

  orders: {
    // Customer places an order for a product
    create: (product_id, token, quantity = 1) =>
      request('/api/orders', { method: 'POST', body: { product_id, quantity }, token }),

    // Customer fetches their own purchase history
    mine: (token) => request('/api/orders/mine', { token }),

    checkout: (body, token) => request('/api/orders/checkout', { method: 'POST', body, token }),
    checkoutCart: (body, token) => request('/api/orders/checkout-cart', { method: 'POST', body, token }),
    timeline: (orderId, token) => request(`/api/orders/${orderId}/timeline`, { token }),
    scheduleLive: (orderId, scheduled_at, token) =>
      request(`/api/orders/${orderId}/live-schedule`, { method: 'PATCH', body: { scheduled_at }, token }),
    sales: (token) => request('/api/orders/sales', { token }),
    confirmCod: (orderId, token) => request(`/api/orders/${orderId}/cod-confirm`, { method: 'POST', token }),
    verifyPayment: (body, token) =>
      request('/api/orders/verify-payment', { method: 'POST', body, token }),

    // Customer reviews a delivered order (once; reviews cannot be edited)
    review: (orderId, body, token) =>
      request(`/api/orders/${orderId}/review`, { method: 'POST', body, token }),

    // Artisan fetches all orders incoming to their shop(s)
    shop: (token) => request('/api/orders/shop', { token }),

    // Artisan accepts an order or marks it Delivered / Cancelled
    updateStatus: (orderId, status, token) =>
      request(`/api/orders/${orderId}/status`, { method: 'PATCH', body: { status }, token }),
  },

  // Private per-order livestream signalling (see components/LiveBroadcast.jsx)
  streams: {
    state: (orderId, token) => request(`/api/streams/${orderId}`, { token }),
    start: (orderId, offer, token) =>
      request(`/api/streams/${orderId}/start`, { method: 'POST', body: { offer }, token }),
    offer: (orderId, offer, version, token) =>
      request(`/api/streams/${orderId}/offer`, { method: 'PUT', body: { offer, version }, token }),
    answer: (orderId, answer, version, token) =>
      request(`/api/streams/${orderId}/answer`, { method: 'POST', body: { answer, version }, token }),
    rejoin: (orderId, token) => request(`/api/streams/${orderId}/rejoin`, { method: 'POST', token }),
    end: (orderId, token) => request(`/api/streams/${orderId}/end`, { method: 'POST', token }),
  },

  cart: {
    get: (token) => request('/api/cart', { token }),
    add: (product_id, quantity, token) => request('/api/cart', { method: 'POST', body: { product_id, quantity }, token }),
    update: (productId, quantity, token) =>
      request(`/api/cart/${productId}`, { method: 'PUT', body: { quantity }, token }),
    remove: (productId, token) => request(`/api/cart/${productId}`, { method: 'DELETE', token }),
  },

  wishlists: {
    list: (token) => request('/api/wishlists', { token }),
    create: (name, token) => request('/api/wishlists', { method: 'POST', body: { name }, token }),
    rename: (id, name, token) => request(`/api/wishlists/${id}`, { method: 'PATCH', body: { name }, token }),
    remove: (id, token) => request(`/api/wishlists/${id}`, { method: 'DELETE', token }),
    addItem: (id, product_id, token) =>
      request(`/api/wishlists/${id}/items`, { method: 'POST', body: { product_id }, token }),
    removeItem: (id, productId, token) =>
      request(`/api/wishlists/${id}/items/${productId}`, { method: 'DELETE', token }),
  },

  notifications: {
    list: (token) => request('/api/notifications', { token }),
    unreadCount: (token) => request('/api/notifications/unread-count', { token }),
    markRead: (ids, token) => request('/api/notifications/read', { method: 'POST', body: { ids }, token }),
  },

  ai: {
    status: (token) => request('/api/ai/status', { token }),
    listing: (file, lang, token) => {
      const form = new FormData();
      form.append('image', file);
      form.append('lang', lang);
      return request('/api/ai/listing', { method: 'POST', body: form, token, form: true });
    },
  },

  events: {
    venues: () => request('/api/events/venues'),
    list: (token) => request('/api/events', { token }),
    create: (body, token) => request('/api/events', { method: 'POST', body, token }),
    respond: (id, body, token) => request(`/api/events/${id}/respond`, { method: 'POST', body, token }),
    approve: (id, note, token) => request(`/api/events/${id}/approve`, { method: 'POST', body: { note }, token }),
    reject: (id, note, token) => request(`/api/events/${id}/reject`, { method: 'POST', body: { note }, token }),
  },

  ranks: {
    list: () => request('/api/ranks'),
    mine: (token) => request('/api/ranks/me', { token }),
  },

  admin: {
    overview: (token) => request('/api/admin/overview', { token }),
    activity: (params, token) => request(`/api/admin/activity?${new URLSearchParams(params)}`, { token }),
    users: (params, token) => request(`/api/admin/users?${new URLSearchParams(params)}`, { token }),
    setUserStatus: (id, active, reason, token) =>
      request(`/api/admin/users/${id}/status`, { method: 'PATCH', body: { active, reason }, token }),
    orders: (params, token) => request(`/api/admin/orders?${new URLSearchParams(params)}`, { token }),
    reviews: (token) => request('/api/admin/reviews', { token }),
    removeReview: (id, reason, token) => request(`/api/admin/reviews/${id}`, { method: 'DELETE', body: { reason }, token }),
  },

  chat: {
    openShop: (shopId, token, customer_id) =>
      request(`/api/chat/shops/${shopId}/conversation`, {
        method: 'POST',
        body: customer_id ? { customer_id } : undefined,
        token,
      }),
    conversations: (token) => request('/api/chat/conversations', { token }),
    messages: (conversationId, token) =>
      request(`/api/chat/conversations/${conversationId}/messages`, { token }),
    send: (conversationId, body, token) =>
      request(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { body },
        token,
      }),
  },
};

export { BASE as API_BASE };

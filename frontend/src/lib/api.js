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
    verifyPayment: (body, token) =>
      request('/api/orders/verify-payment', { method: 'POST', body, token }),

    // Artisan fetches all orders incoming to their shop(s)
    shop: (token) => request('/api/orders/shop', { token }),

    // Artisan marks an order Delivered / Cancelled
    updateStatus: (orderId, status, token) =>
      request(`/api/orders/${orderId}/status`, { method: 'PATCH', body: { status }, token }),
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

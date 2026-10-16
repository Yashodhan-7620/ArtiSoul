// Single place that knows how to talk to the Phase 2 Express API.
// Every call returns the parsed `data` field, or throws an Error carrying
// the backend's own message so screens can render it verbatim.

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

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

  return payload;
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
    updateQr: (upi_qr_url, token) =>
      request('/api/shops/my-qr', { method: 'PUT', body: { upi_qr_url }, token }),
    getQr: (shopId) => request(`/api/shops/qr/${shopId}`),
  },

  products: {
    add: (body, token) => request('/api/products/add', { method: 'POST', body, token }),
    nearby: ({ lat, lng, radius = 5, category }) => {
      const qs = new URLSearchParams({ lat, lng, radius });
      if (category) qs.set('category', category);
      return request(`/api/products/nearby?${qs}`);
    },
    byId: (id) => request(`/api/products/${id}`),
    byShop: (shopId) => request(`/api/products/shop/${shopId}`),
  },

  uploads: {
    image: (file, token) => {
      const form = new FormData();
      form.append('image', file);
      return request('/api/uploads/image', { method: 'POST', body: form, token, form: true });
    },
  },

  orders: {
    // Supports full checkout payload object: api.orders.create(payload, token)
    // as well as legacy signature: api.orders.create(product_id, token, quantity)
    create: (payloadOrProductId, token, quantity = 1) => {
      const body =
        typeof payloadOrProductId === 'object' && payloadOrProductId !== null
          ? payloadOrProductId
          : { product_id: payloadOrProductId, quantity };
      return request('/api/orders', { method: 'POST', body, token });
    },

    // Customer fetches their own purchase history
    mine: (token) => request('/api/orders/mine', { token }),

    // Artisan fetches all orders incoming to their shop(s)
    shop: (token) => request('/api/orders/shop', { token }),

    // Artisan marks an order Delivered / Cancelled (and optionally updates payment_status)
    updateStatus: (orderId, status, token, payment_status) =>
      request(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: payment_status ? { status, payment_status } : { status },
        token,
      }),
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
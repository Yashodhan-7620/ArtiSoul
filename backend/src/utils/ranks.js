const { pool } = require('../config/db');

// Artisan ranks, from sales performance. Only DELIVERED orders count (a sale
// is real once the buyer has it). Checked from the top; the first tier whose
// every condition is met is the artisan's rank. No delivered sale = no rank.
//
//   1 Master    ₹1,00,000+ delivered, 50+ orders, rating 4.5+ (5+ reviews)
//   2 Gold      ₹50,000+  delivered, 25+ orders, rating 4.0+ (5+ reviews)
//   3 Silver    ₹20,000+  delivered, 10+ orders
//   4 Rising    ₹5,000+   delivered,  3+ orders
//   5 Newcomer  at least 1 delivered order
//   6 No rank   no delivered orders yet
const TIERS = [
  { key: 'master', level: 1, minRevenue: 100000, minOrders: 50, minRating: 4.5, minReviews: 5 },
  { key: 'gold', level: 2, minRevenue: 50000, minOrders: 25, minRating: 4.0, minReviews: 5 },
  { key: 'silver', level: 3, minRevenue: 20000, minOrders: 10 },
  { key: 'rising', level: 4, minRevenue: 5000, minOrders: 3 },
  { key: 'newcomer', level: 5, minRevenue: 0, minOrders: 1 },
];
const NO_RANK = { key: 'none', level: 6 };

function meets(stats, tier) {
  if (stats.revenue < tier.minRevenue || stats.orders < tier.minOrders) return false;
  if (tier.minRating && (stats.reviews < tier.minReviews || stats.rating < tier.minRating)) return false;
  return true;
}

function rankOf(stats) {
  return TIERS.find((t) => meets(stats, t)) || NO_RANK;
}

// What the artisan still needs for the next rank up (null at the top).
function nextStep(stats) {
  const current = rankOf(stats);
  const next = [...TIERS].reverse().find((t) => t.level < current.level);
  if (!next) return null;
  return {
    key: next.key,
    revenue_needed: Math.max(0, next.minRevenue - stats.revenue),
    orders_needed: Math.max(0, next.minOrders - stats.orders),
    rating_needed: next.minRating && stats.rating < next.minRating ? next.minRating : null,
    reviews_needed: next.minReviews ? Math.max(0, next.minReviews - stats.reviews) : 0,
  };
}

// Sales stats per artisan (all artisans, or the given ids).
async function artisanStats(ids = null) {
  const filter = ids ? 'AND u.user_id IN (?)' : '';
  const [rows] = await pool.query(
    `SELECT u.user_id AS artisan_id,
            COALESCE(d.orders, 0) AS orders, COALESCE(d.revenue, 0) AS revenue,
            COALESCE(r.reviews, 0) AS reviews, COALESCE(r.rating, 0) AS rating
     FROM Users u
     LEFT JOIN (
       SELECT s.artisan_id, COUNT(*) AS orders, SUM(o.price_at_purchase * o.quantity) AS revenue
       FROM Orders o JOIN Shops s ON s.shop_id = o.shop_id
       WHERE o.status = 'Delivered' GROUP BY s.artisan_id
     ) d ON d.artisan_id = u.user_id
     LEFT JOIN (
       SELECT s.artisan_id, COUNT(*) AS reviews, AVG(rv.rating) AS rating
       FROM Reviews rv JOIN Products p ON p.product_id = rv.product_id JOIN Shops s ON s.shop_id = p.shop_id
       GROUP BY s.artisan_id
     ) r ON r.artisan_id = u.user_id
     WHERE u.role = 'artisan' AND u.is_active = 1 ${filter}`,
    ids ? [ids] : []
  );
  return rows.map((r) => {
    const stats = {
      artisan_id: r.artisan_id,
      orders: Number(r.orders),
      revenue: Number(r.revenue),
      reviews: Number(r.reviews),
      rating: Math.round(Number(r.rating) * 10) / 10,
    };
    const rank = rankOf(stats);
    return { ...stats, rank: rank.key, rank_level: rank.level };
  });
}

// Public view of the tier rules (for the help page).
const RULES = [...TIERS.map(({ key, level, minRevenue, minOrders, minRating, minReviews }) => ({
  key, level, min_revenue: minRevenue, min_orders: minOrders, min_rating: minRating || null, min_reviews: minReviews || 0,
})), { key: 'none', level: 6 }];

module.exports = { artisanStats, rankOf, nextStep, RULES };

// Checks that every translation key used in src/ exists in English, and that
// Hindi and Marathi have exactly the same keys (no missing, no stale ones).
//   node scripts/check-i18n.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from '../src/i18n/en.js';
import hi from '../src/i18n/hi.js';
import mr from '../src/i18n/mr.js';

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(name) && !p.includes(join('src', 'i18n'))) files.push(p);
  }
})(SRC);

const used = new Set();
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(m[1]);
  for (const m of text.matchAll(/label: '(nav\.[\w.]+)'|desktopLabel: '(nav\.[\w.]+)'/g)) used.add(m[1] || m[2]);
}
// Keys built at runtime from a fixed set of values.
const dynamic = {
  'status.': ['Pending', 'Accepted', 'Shipped', 'Delivered', 'Cancelled'],
  'role.': ['customer', 'artisan', 'admin'],
  'timeline.': ['Placed', 'Paid', 'PaymentFailed', 'Accepted', 'Live', 'Shipped', 'Delivered', 'Cancelled', 'CodPaid'],
  'notif.status.': ['Accepted', 'Shipped', 'Delivered', 'Cancelled'],
  'admin.tab.': ['overview', 'activity', 'users', 'orders', 'reviews'],
  'add.angle.': ['front', 'right', 'back', 'left', 'top', 'bottom'],
  'dash.filter_': ['open', 'all'],
  'auth.role_': ['customer', 'artisan', 'customer_hint', 'artisan_hint'],
  'welcome.f.': ['near.title', 'near.body', 'maker.title', 'maker.body', 'quick.title', 'quick.body'],
  'events.act.': ['exhibit', 'sell', 'resale', 'popup_shop', 'meetup', 'inspire', 'workshop'],
  'events.status.': ['open', 'pending_approval', 'approved'],
  'events.tab.': ['events', 'venues'],
  'rank.': ['master', 'gold', 'silver', 'rising', 'newcomer', 'none'].flatMap((r) => [`${r}.name`, `${r}.rule`]),
  'help.buy.': ['1', '2', '3', '4', '5', '6'],
  'help.sell.': ['1', '2', '3', '4', '5', '6'],
  'help.pay.': ['1', '2', '3'],
  'help.events.': ['1', '2', '3', '4'],
  'help.safe.': ['1', '2', '3', '4'],
  'cat.': ['Textiles', 'Pottery', 'Jewellery', 'Woodwork', 'Painting', 'Leather', 'Metalwork', 'Home Decor'],
};
for (const [prefix, values] of Object.entries(dynamic)) values.forEach((v) => used.add(prefix + v));
// Picked by a lookup or ternary inside t(...).
['dash.cancel_confirm', 'dash.ship_confirm', 'dash.deliver_confirm', 'add.saved_video', 'add.saved_image',
  'cod.confirm_buyer', 'cod.confirm_artisan', 'cod.waiting_artisan', 'cod.waiting_buyer', 'cod.button_buyer', 'cod.button_artisan'].forEach((k) => used.add(k));

const has = (dict, k) => k in dict || (`${k}_one` in dict && `${k}_other` in dict);
let problems = 0;
const report = (label, list) => {
  if (!list.length) return;
  problems += list.length;
  console.log(`\n${label} (${list.length}):\n  ${list.join('\n  ')}`);
};

report('Used in code but missing in en.js', [...used].filter((k) => !has(en, k)).sort());
for (const [name, dict] of [['hi', hi], ['mr', mr]]) {
  report(`Missing in ${name}.js`, Object.keys(en).filter((k) => !(k in dict)));
  report(`Extra (stale) keys in ${name}.js`, Object.keys(dict).filter((k) => !(k in en)));
  const badVars = Object.keys(en).filter((k) => {
    if (!(k in dict)) return false;
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    return vars(en[k]) !== vars(dict[k]);
  });
  report(`Placeholder mismatch in ${name}.js`, badVars);
}
report('Defined in en.js but never used', Object.keys(en).filter((k) => !used.has(k) && !used.has(k.replace(/_(one|other)$/, ''))));

console.log(problems ? `\n${problems} problem(s)` : `All ${Object.keys(en).length} keys present in en, hi and mr; ${used.size} keys used.`);
process.exit(problems ? 1 : 0);

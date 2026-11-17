// Promote an existing account to admin. There is deliberately no way to sign
// up as an admin, or to make someone an admin from inside the app.
//   npm run make-admin -- <phone>
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../src/config/db');
const { audit } = require('../src/utils/audit');

(async () => {
  const phone = process.argv[2];
  if (!phone) {
    console.error('Usage: npm run make-admin -- <phone number of an existing account>');
    process.exit(1);
  }
  const [[user]] = await pool.query('SELECT user_id, name, role FROM Users WHERE phone = ?', [phone]);
  if (!user) {
    console.error('No account with that phone number. Sign up in the app first.');
    process.exit(1);
  }
  await pool.query("UPDATE Users SET role = 'admin', is_active = 1 WHERE user_id = ?", [user.user_id]);
  await audit(null, 'admin.promoted', { entity: 'user', entityId: user.user_id, details: { from: user.role, via: 'cli' } });
  console.log(`${user.name} (user ${user.user_id}) is now an admin. Log out and back in to see the Admin panel.`);
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

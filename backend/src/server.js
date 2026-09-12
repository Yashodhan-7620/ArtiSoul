require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = process.env.PORT || 5000;

(async () => {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🚀 ArtiSoul backend running on http://localhost:${PORT}`);
  });
})();

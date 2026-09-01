// Catches anything passed to next(err), plus thrown errors in async
// route handlers (see utils/asyncHandler.js), and formats one JSON shape.
function errorHandler(err, req, res, next) {
  console.error(err);

  // MySQL duplicate entry (e.g. phone number already registered)
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'Duplicate entry — this record already exists' });
  }

  // MySQL foreign key violation (e.g. shop_id / product_id doesn't exist)
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ success: false, message: 'Invalid reference — related record does not exist' });
  }

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;

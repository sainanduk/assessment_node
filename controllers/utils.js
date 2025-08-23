// controllers/utils.js
const { ValidationError } = require('sequelize');

class ControllerUtils {
  static parsePagination(query) {
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
  }

  static handleSequelizeError(err, res) {
    if (err instanceof ValidationError) {
      return res.status(400).json({
        error: 'ValidationError',
        details: err.errors.map(e => e.message)
      });
    }
    console.error(err);
    return res.status(500).json({ error: 'InternalServerError' });
  }

  // Helper to pick whitelisted fields
  static pick(source, fields) {
    return fields.reduce((acc, f) => {
      if (Object.prototype.hasOwnProperty.call(source, f)) acc[f] = source[f];
      return acc;
    }, {});
  }
}

module.exports = ControllerUtils;

import { getDbStatus } from '../config/db.js';

export function getHealth(_req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      database: getDbStatus(),
      timestamp: new Date().toISOString(),
    },
  });
}

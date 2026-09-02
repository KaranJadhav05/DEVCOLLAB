const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  dispatchNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Client routes
router.get('/', protect, getNotifications);
router.put('/:id/read', protect, markAsRead);
router.put('/read-all', protect, markAllAsRead);

// Internal Inter-Process Communication (IPC) endpoint for other microservices
router.post('/dispatch', dispatchNotification);

module.exports = router;

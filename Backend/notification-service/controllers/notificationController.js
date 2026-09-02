const Notification = require('../models/Notification');

// @desc    Get all notifications for logged-in user
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Internal IPC Endpoint: Dispatch a notification from another microservice
// @route   POST /api/notifications/dispatch
// @access  Internal Network / Service API Key
const dispatchNotification = async (req, res) => {
  try {
    const { recipient, sender, senderName, senderAvatar, type, title, message, link, metadata } = req.body;

    if (!recipient || !title || !message) {
      return res.status(400).json({ message: 'Recipient, title, and message are required' });
    }

    const notification = await Notification.create({
      recipient,
      sender,
      senderName: senderName || 'DevCollab Node',
      senderAvatar: senderAvatar || '',
      type: type || 'system_alert',
      title,
      message,
      link: link || '',
      metadata: metadata || {},
    });

    console.log(`📡 [Notification Service IPC] Notification dispatched to user ${recipient}: "${title}"`);

    res.status(201).json({
      success: true,
      service: 'notification-service',
      notification,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  dispatchNotification,
};

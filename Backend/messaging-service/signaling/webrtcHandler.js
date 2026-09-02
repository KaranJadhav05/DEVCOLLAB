// Socket.IO & WebRTC Signaling Handler for Messaging Service
// Covers:
// - Real-time Chat (Task 31)
// - Typing Indicators (Task 32)
// - Online / Offline Presence Tracking (Task 33)
// - WebRTC Video Meeting Rooms (Task 83)
// - Voice Communication (Task 84)
// - Screen Sharing Streams (Task 49)
// - P2P Direct File Transfer Signaling (Task 50)

const Message = require('../models/Message');
const { buildConversationId } = require('../controllers/messageController');

// In-memory maps
const onlineUsers = new Map(); // userId -> { socketId, user }
const meetingRooms = new Map(); // roomId -> Map(socketId -> { userId, userName, avatar, audioEnabled, videoEnabled, screenSharing })

function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    const userName = socket.user.name;
    const userAvatar = socket.user.avatar || '';

    console.log(`🟢 [Messaging Service] Socket Connected: ${userName} (${userId}) [Socket ID: ${socket.id}]`);

    // ── Register User Online (Task 33) ────────────────────────────────────────
    onlineUsers.set(userId, { socketId: socket.id, user: socket.user });
    io.emit('online_users', Array.from(onlineUsers.keys()));

    // ── 1. Real-Time Chat (Task 31) ───────────────────────────────────────────
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, text, attachment } = data;
        if (!receiverId || !text) return;

        const conversationId = buildConversationId(userId, receiverId);

        const message = await Message.create({
          conversationId,
          sender: socket.user._id,
          receiver: receiverId,
          text,
          attachment,
        });

        const populated = await Message.findById(message._id)
          .populate('sender', 'name avatar')
          .populate('receiver', 'name avatar');

        // Relay to receiver if online
        const receiverEntry = onlineUsers.get(receiverId);
        if (receiverEntry) {
          io.to(receiverEntry.socketId).emit('receive_message', populated);
        }

        // Echo back to sender
        socket.emit('message_sent', populated);
      } catch (err) {
        console.error('Socket send_message error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── 2. Typing Indicators (Task 32) ────────────────────────────────────────
    socket.on('typing', (data) => {
      const receiverEntry = onlineUsers.get(data.receiverId);
      if (receiverEntry) {
        io.to(receiverEntry.socketId).emit('typing', { senderId: userId, senderName: userName });
      }
    });

    socket.on('stop_typing', (data) => {
      const receiverEntry = onlineUsers.get(data.receiverId);
      if (receiverEntry) {
        io.to(receiverEntry.socketId).emit('stop_typing', { senderId: userId });
      }
    });

    // ── 3. WebRTC Meeting Rooms & Distributed Multimedia (Tasks 83, 84, 49, 50) ──
    // Join a meeting room (e.g. project meeting or 1-on-1 direct session)
    socket.on('webrtc_join_room', ({ roomId, isAudioOnly = false, userNameOverride }) => {
      socket.join(roomId);

      if (!meetingRooms.has(roomId)) {
        meetingRooms.set(roomId, new Map());
      }

      const roomPeers = meetingRooms.get(roomId);
      const participantInfo = {
        socketId: socket.id,
        userId,
        userName: userNameOverride || userName,
        avatar: userAvatar,
        audioEnabled: true,
        videoEnabled: !isAudioOnly,
        screenSharing: false,
        joinedAt: new Date().toISOString(),
      };

      // Notify existing peers in the room about the new participant
      socket.to(roomId).emit('webrtc_user_joined', participantInfo);

      // Save participant to room
      roomPeers.set(socket.id, participantInfo);

      // Send list of existing participants in the room back to the joined user
      const existingParticipants = Array.from(roomPeers.values()).filter(p => p.socketId !== socket.id);
      socket.emit('webrtc_room_users', {
        roomId,
        participants: existingParticipants,
      });

      console.log(`📹 [WebRTC Room] ${userName} joined room "${roomId}" (Total peers: ${roomPeers.size})`);
    });

    // WebRTC Offer Relay
    socket.on('webrtc_offer', ({ targetSocketId, offer, roomId }) => {
      io.to(targetSocketId).emit('webrtc_offer', {
        senderSocketId: socket.id,
        senderUserId: userId,
        senderName: userName,
        offer,
        roomId,
      });
    });

    // WebRTC Answer Relay
    socket.on('webrtc_answer', ({ targetSocketId, answer, roomId }) => {
      io.to(targetSocketId).emit('webrtc_answer', {
        senderSocketId: socket.id,
        senderUserId: userId,
        answer,
        roomId,
      });
    });

    // WebRTC ICE Candidate Relay
    socket.on('webrtc_ice_candidate', ({ targetSocketId, candidate, roomId }) => {
      io.to(targetSocketId).emit('webrtc_ice_candidate', {
        senderSocketId: socket.id,
        candidate,
        roomId,
      });
    });

    // Media State Toggle Relay (Mic / Camera / Screen Share)
    socket.on('webrtc_toggle_media', ({ roomId, audioEnabled, videoEnabled, screenSharing }) => {
      if (meetingRooms.has(roomId)) {
        const roomPeers = meetingRooms.get(roomId);
        if (roomPeers.has(socket.id)) {
          const peer = roomPeers.get(socket.id);
          if (audioEnabled !== undefined) peer.audioEnabled = audioEnabled;
          if (videoEnabled !== undefined) peer.videoEnabled = videoEnabled;
          if (screenSharing !== undefined) peer.screenSharing = screenSharing;
        }
      }

      socket.to(roomId).emit('webrtc_user_media_changed', {
        socketId: socket.id,
        userId,
        audioEnabled,
        videoEnabled,
        screenSharing,
      });
    });

    // In-meeting chat message
    socket.on('webrtc_room_message', ({ roomId, text }) => {
      if (!roomId || !text) return;
      io.to(roomId).emit('webrtc_room_message', {
        senderId: userId,
        senderName: userName,
        senderAvatar: userAvatar,
        text,
        timestamp: new Date().toISOString(),
      });
    });

    // Leave meeting room
    socket.on('webrtc_leave_room', ({ roomId }) => {
      handleLeaveRoom(socket, roomId);
    });

    // ── 4. Disconnect Handler ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔴 [Messaging Service] Socket Disconnected: ${userName}`);
      onlineUsers.delete(userId);
      io.emit('online_users', Array.from(onlineUsers.keys()));

      // Clean up from all meeting rooms
      meetingRooms.forEach((roomPeers, roomId) => {
        if (roomPeers.has(socket.id)) {
          handleLeaveRoom(socket, roomId);
        }
      });
    });
  });

  function handleLeaveRoom(socket, roomId) {
    socket.leave(roomId);
    if (meetingRooms.has(roomId)) {
      const roomPeers = meetingRooms.get(roomId);
      roomPeers.delete(socket.id);
      socket.to(roomId).emit('webrtc_user_left', { socketId: socket.id, userId: socket.user._id });
      if (roomPeers.size === 0) {
        meetingRooms.delete(roomId);
      }
    }
  }
}

module.exports = {
  initSocketHandlers,
  onlineUsers,
  meetingRooms,
};

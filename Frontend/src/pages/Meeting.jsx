import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, VideoOff, Mic, MicOff, MonitorUp, MonitorOff,
  PhoneOff, Users, MessageSquare, Send, Upload, FileText,
  Download, CheckCircle, Copy, Check, ShieldCheck, Sparkles, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ICE Server configurations (STUN for NAT traversal)
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CHUNK_SIZE = 16384; // 16KB chunks for RTCDataChannel P2P file transfer

const Meeting = () => {
  const { roomId = 'general-room' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, socket } = useAuth();

  const projectName = location.state?.projectTitle || `Meeting Room: ${roomId}`;

  // Media States
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Peers and WebRTC Connections (peerSocketId -> RTCPeerConnection)
  const peerConnectionsRef = useRef(new Map());
  const dataChannelsRef = useRef(new Map()); // peerSocketId -> RTCDataChannel
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // socketId -> { stream, participant }

  // Meeting Room Info & Participants
  const [participants, setParticipants] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'files' | 'participants'
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // P2P File Transfer States (Task 50)
  const [incomingFiles, setIncomingFiles] = useState([]);
  const [outgoingFiles, setOutgoingFiles] = useState([]);
  const fileReceiversRef = useRef(new Map()); // fileId -> { name, size, type, receivedChunks, totalSize }

  // Refs for local video
  const localVideoRef = useRef(null);
  const chatEndRef = useRef(null);

  // ── 1. Initialize Local Media Stream ──────────────────────────────────────────
  useEffect(() => {
    let stream = null;

    const startLocalMedia = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Could not access camera/mic, falling back to audio-only or view mode:', err.message);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setLocalStream(stream);
          setIsVideoMuted(true);
        } catch {
          console.warn('No media devices available');
        }
      }
    };

    startLocalMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // ── 2. Helper to Create Peer Connection & RTCDataChannel ─────────────────────
  const createPeerConnection = useCallback((targetSocketId, targetParticipant, isInitiator = false) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(targetSocketId, pc);

    // Add local tracks to peer connection
    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    // Handle incoming remote track
    pc.ontrack = (event) => {
      console.log(`📡 [WebRTC] Received remote track from ${targetSocketId}:`, event.track.kind);
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(targetSocketId, {
          stream: event.streams[0],
          participant: targetParticipant,
        });
        return next;
      });
    };

    // Handle ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_ice_candidate', {
          targetSocketId,
          candidate: event.candidate,
          roomId,
        });
      }
    };

    // ── Setup P2P RTCDataChannel for Direct File Transfer (Task 50) ───────────
    if (isInitiator) {
      const dataChannel = pc.createDataChannel('fileTransfer', {
        ordered: true,
      });
      setupDataChannel(dataChannel, targetSocketId);
      dataChannelsRef.current.set(targetSocketId, dataChannel);
    } else {
      pc.ondatachannel = (event) => {
        const dataChannel = event.channel;
        setupDataChannel(dataChannel, targetSocketId);
        dataChannelsRef.current.set(targetSocketId, dataChannel);
      };
    }

    return pc;
  }, [localStream, roomId, socket]);

  // Setup DataChannel Listeners for Direct File Transfer
  const setupDataChannel = (channel, peerSocketId) => {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log(`⚡ [P2P DataChannel] Open with peer ${peerSocketId}`);
    };

    channel.onmessage = (event) => {
      handleDataChannelMessage(event.data, peerSocketId);
    };

    channel.onerror = (error) => {
      console.error(`❌ [P2P DataChannel Error]:`, error);
    };
  };

  // Handle incoming data channel chunks and files
  const handleDataChannelMessage = (data, peerSocketId) => {
    if (typeof data === 'string') {
      try {
        const message = JSON.parse(data);
        if (message.type === 'file_meta') {
          // File transfer starting
          fileReceiversRef.current.set(message.fileId, {
            id: message.fileId,
            name: message.name,
            size: message.size,
            fileType: message.fileType,
            receivedBytes: 0,
            chunks: [],
            senderName: message.senderName,
          });

          setIncomingFiles((prev) => [
            {
              id: message.fileId,
              name: message.name,
              size: message.size,
              progress: 0,
              completed: false,
              senderName: message.senderName,
            },
            ...prev,
          ]);
        }
      } catch (e) {
        console.error('Data channel parse error', e);
      }
    } else if (data instanceof ArrayBuffer) {
      // Chunk received - read header (first 36 bytes for file UUID)
      const fileIdBytes = new Uint8Array(data.slice(0, 36));
      const fileId = new TextDecoder().decode(fileIdBytes);
      const chunkData = data.slice(36);

      const fileInfo = fileReceiversRef.current.get(fileId);
      if (fileInfo) {
        fileInfo.chunks.push(chunkData);
        fileInfo.receivedBytes += chunkData.byteLength;

        const progress = Math.min(100, Math.round((fileInfo.receivedBytes / fileInfo.size) * 100));

        setIncomingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  progress,
                  completed: fileInfo.receivedBytes >= fileInfo.size,
                }
              : f
          )
        );

        if (fileInfo.receivedBytes >= fileInfo.size) {
          // Complete file assembled!
          const blob = new Blob(fileInfo.chunks, { type: fileInfo.fileType || 'application/octet-stream' });
          const downloadUrl = URL.createObjectURL(blob);

          setIncomingFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, downloadUrl, completed: true } : f))
          );
        }
      }
    }
  };

  // ── 3. Socket Signaling Handlers ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !localStream) return;

    // Join WebRTC room
    socket.emit('webrtc_join_room', {
      roomId,
      isAudioOnly: isVideoMuted,
      userNameOverride: user?.name,
    });

    // Handle existing users in the room (I am the initiator to them)
    const handleRoomUsers = async ({ participants: existingPeers }) => {
      setParticipants(existingPeers);
      for (const peer of existingPeers) {
        const pc = createPeerConnection(peer.socketId, peer, true);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_offer', {
            targetSocketId: peer.socketId,
            offer,
            roomId,
          });
        } catch (err) {
          console.error('Error creating WebRTC offer:', err);
        }
      }
    };

    // Handle a new user joining the room (they will send an offer)
    const handleUserJoined = (newPeer) => {
      setParticipants((prev) => [...prev.filter((p) => p.socketId !== newPeer.socketId), newPeer]);
    };

    // Handle incoming WebRTC Offer
    const handleReceiveOffer = async ({ senderSocketId, senderName, offer }) => {
      const peer = { socketId: senderSocketId, userName: senderName };
      const pc = createPeerConnection(senderSocketId, peer, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', {
          targetSocketId: senderSocketId,
          answer,
          roomId,
        });
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    };

    // Handle incoming WebRTC Answer
    const handleReceiveAnswer = async ({ senderSocketId, answer }) => {
      const pc = peerConnectionsRef.current.get(senderSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('Error handling WebRTC answer:', err);
        }
      }
    };

    // Handle incoming ICE Candidate
    const handleReceiveCandidate = async ({ senderSocketId, candidate }) => {
      const pc = peerConnectionsRef.current.get(senderSocketId);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    };

    // Handle user media changed (mic/cam/screen)
    const handleMediaChanged = ({ socketId, audioEnabled, videoEnabled, screenSharing }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, audioEnabled, videoEnabled, screenSharing } : p))
      );
    };

    // Handle in-meeting chat messages
    const handleRoomMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    // Handle peer disconnect
    const handleUserLeft = ({ socketId }) => {
      if (peerConnectionsRef.current.has(socketId)) {
        peerConnectionsRef.current.get(socketId).close();
        peerConnectionsRef.current.delete(socketId);
      }
      dataChannelsRef.current.delete(socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    };

    socket.on('webrtc_room_users', handleRoomUsers);
    socket.on('webrtc_user_joined', handleUserJoined);
    socket.on('webrtc_offer', handleReceiveOffer);
    socket.on('webrtc_answer', handleReceiveAnswer);
    socket.on('webrtc_ice_candidate', handleReceiveCandidate);
    socket.on('webrtc_user_media_changed', handleMediaChanged);
    socket.on('webrtc_room_message', handleRoomMessage);
    socket.on('webrtc_user_left', handleUserLeft);

    return () => {
      socket.emit('webrtc_leave_room', { roomId });
      socket.off('webrtc_room_users', handleRoomUsers);
      socket.off('webrtc_user_joined', handleUserJoined);
      socket.off('webrtc_offer', handleReceiveOffer);
      socket.off('webrtc_answer', handleReceiveAnswer);
      socket.off('webrtc_ice_candidate', handleReceiveCandidate);
      socket.off('webrtc_user_media_changed', handleMediaChanged);
      socket.off('webrtc_room_message', handleRoomMessage);
      socket.off('webrtc_user_left', handleUserLeft);

      // Clean up peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      dataChannelsRef.current.clear();
    };
  }, [socket, localStream, roomId, user, isVideoMuted, createPeerConnection]);

  // ── 4. Media Controls ────────────────────────────────────────────────────────
  // Toggle Microphone (Task 84: Voice Communication)
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        socket?.emit('webrtc_toggle_media', {
          roomId,
          audioEnabled: audioTrack.enabled,
        });
      }
    }
  };

  // Toggle Video Camera (Task 83: Video Meeting)
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
        socket?.emit('webrtc_toggle_media', {
          roomId,
          videoEnabled: videoTrack.enabled,
        });
      }
    }
  };

  // Toggle Screen Sharing (Task 49: Screen Sharing)
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        setScreenStream(stream);
        setIsScreenSharing(true);

        const screenTrack = stream.getVideoTracks()[0];

        // Replace track on all peer connections
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        socket?.emit('webrtc_toggle_media', {
          roomId,
          screenSharing: true,
        });
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);

    // Restore camera track to peer connections
    if (localStream) {
      const cameraTrack = localStream.getVideoTracks()[0];
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender && cameraTrack) {
          sender.replaceTrack(cameraTrack);
        }
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }

    socket?.emit('webrtc_toggle_media', {
      roomId,
      screenSharing: false,
    });
  };

  // Leave Meeting
  const leaveMeeting = () => {
    navigate('/projects');
  };

  // ── 5. P2P Direct File Transfer over RTCDataChannel (Task 50) ────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const metadata = {
      type: 'file_meta',
      fileId,
      name: file.name,
      size: file.size,
      fileType: file.type,
      senderName: user?.name || 'Peer',
    };

    setOutgoingFiles((prev) => [
      { id: fileId, name: file.name, size: file.size, progress: 0, completed: false },
      ...prev,
    ]);

    // Send metadata JSON to all connected data channels
    dataChannelsRef.current.forEach((channel) => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(metadata));
      }
    });

    // Read and chunk binary data
    const reader = new FileReader();
    reader.onload = async (event) => {
      const buffer = event.target.result;
      const fileIdEncoder = new TextEncoder();
      const fileIdPadded = new Uint8Array(36);
      fileIdPadded.set(fileIdEncoder.encode(fileId.padEnd(36, ' ')));

      let offset = 0;
      while (offset < buffer.byteLength) {
        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        const packet = new Uint8Array(36 + chunk.byteLength);
        packet.set(fileIdPadded, 0);
        packet.set(new Uint8Array(chunk), 36);

        dataChannelsRef.current.forEach((channel) => {
          if (channel.readyState === 'open') {
            channel.send(packet.buffer);
          }
        });

        offset += CHUNK_SIZE;
        const progress = Math.min(100, Math.round((offset / buffer.byteLength) * 100));

        setOutgoingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress, completed: progress >= 100 } : f))
        );

        // Yield to prevent socket buffer overload
        await new Promise((r) => setTimeout(r, 15));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Send In-Meeting Chat Message
  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;

    socket.emit('webrtc_room_message', {
      roomId,
      text: chatInput.trim(),
    });
    setChatInput('');
  };

  // Copy Room Link
  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 70px)',
      background: '#090d16',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      padding: '1rem 1.5rem',
      gap: '1rem',
    }}>
      {/* Meeting Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '1rem',
        padding: '0.85rem 1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            padding: '0.5rem',
            borderRadius: '0.6rem',
            display: 'flex',
          }}>
            <Video size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>{projectName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span>Room ID: <strong>{roomId}</strong></span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#34d399' }}>
                <ShieldCheck size={13} /> P2P WebRTC Encrypted Mesh
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            onClick={copyRoomLink}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'inherit',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {copiedLink ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
            {copiedLink ? 'Copied Link!' : 'Invite Team'}
          </button>

          <button
            onClick={leaveMeeting}
            style={{
              background: '#ef4444',
              border: 'none',
              color: '#fff',
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            <PhoneOff size={15} /> Leave
          </button>
        </div>
      </div>

      {/* Main Grid: Video Stage & Collaboration Sidebar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '1rem',
        flex: 1,
        minHeight: '520px',
      }}>
        {/* Left Side: Video Streams Grid (Tasks 83, 84, 49) */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '1.25rem',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          {/* Video Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: remoteStreams.size > 0 ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
            gap: '1rem',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Local Video Stream */}
            <div style={{
              position: 'relative',
              background: '#131926',
              borderRadius: '1rem',
              overflow: 'hidden',
              aspectRatio: '16/9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: isVideoMuted ? 'none' : 'block',
                  transform: isScreenSharing ? 'none' : 'scaleX(-1)',
                }}
              />

              {isVideoMuted && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 70, height: 70, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', fontWeight: 800, margin: '0 auto 0.5rem',
                  }}>
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Camera Off</span>
                </div>
              )}

              {/* Local Participant Badge */}
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
                padding: '0.3rem 0.65rem',
                borderRadius: '0.5rem',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}>
                <span>{user?.name || 'You'} (You)</span>
                {isAudioMuted ? <MicOff size={13} color="#ef4444" /> : <Mic size={13} color="#22c55e" />}
                {isScreenSharing && <MonitorUp size={13} color="#38bdf8" />}
              </div>
            </div>

            {/* Remote Peer Video Streams */}
            {Array.from(remoteStreams.entries()).map(([peerSocketId, { stream, participant }]) => (
              <RemoteVideoCard
                key={peerSocketId}
                stream={stream}
                participant={participant}
              />
            ))}
          </div>

          {/* Media Control Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.85rem',
            paddingTop: '1rem',
          }}>
            <button
              onClick={toggleAudio}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: isAudioMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.12)',
                border: 'none', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              title={isAudioMuted ? 'Unmute Audio (Voice)' : 'Mute Audio'}
            >
              {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              onClick={toggleVideo}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: isVideoMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.12)',
                border: 'none', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
            </button>

            <button
              onClick={toggleScreenShare}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: isScreenSharing ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)',
                border: 'none', color: isScreenSharing ? '#000' : '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen (Task 49)'}
            >
              {isScreenSharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
            </button>
          </div>
        </div>

        {/* Right Side: Collaboration Sidebar (Chat, P2P Files, Participants) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}>
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                flex: 1, padding: '0.75rem 0', background: 'none', border: 'none',
                color: activeTab === 'chat' ? '#6366f1' : '#94a3b8',
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                borderBottom: activeTab === 'chat' ? '2px solid #6366f1' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
              }}
            >
              <MessageSquare size={15} /> Chat
            </button>
            <button
              onClick={() => setActiveTab('files')}
              style={{
                flex: 1, padding: '0.75rem 0', background: 'none', border: 'none',
                color: activeTab === 'files' ? '#6366f1' : '#94a3b8',
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                borderBottom: activeTab === 'files' ? '2px solid #6366f1' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
              }}
            >
              <FileText size={15} /> P2P Files ({incomingFiles.length + outgoingFiles.length})
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              style={{
                flex: 1, padding: '0.75rem 0', background: 'none', border: 'none',
                color: activeTab === 'participants' ? '#6366f1' : '#94a3b8',
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                borderBottom: activeTab === 'participants' ? '2px solid #6366f1' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
              }}
            >
              <Users size={15} /> Team ({participants.length + 1})
            </button>
          </div>

          {/* Tab 1: Real-time In-Meeting Chat */}
          {activeTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0.85rem' }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '380px' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', marginTop: '2rem' }}>
                    Welcome to the meeting! Send messages to team members in real-time.
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        alignSelf: msg.senderId === user?._id ? 'flex-end' : 'flex-start',
                        background: msg.senderId === user?._id ? '#4f46e5' : 'rgba(255, 255, 255, 0.08)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.75rem',
                        maxWidth: '85%',
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.8, display: 'block' }}>
                        {msg.senderName}
                      </span>
                      <p style={{ fontSize: '0.82rem', margin: '0.15rem 0 0 0' }}>{msg.text}</p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendChatMessage} style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Type in meeting chat..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  style={{
                    flex: 1, background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '0.5rem', padding: '0.5rem 0.75rem',
                    color: '#fff', fontSize: '0.82rem', outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: '#6366f1', border: 'none', color: '#fff',
                    padding: '0.5rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer',
                  }}
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: P2P Direct File Transfer (Task 50) */}
          {activeTab === 'files' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0.85rem', gap: '0.85rem' }}>
              <div style={{
                border: '2px dashed rgba(99, 102, 241, 0.4)',
                borderRadius: '0.85rem',
                padding: '1.25rem 1rem',
                textAlign: 'center',
                background: 'rgba(99, 102, 241, 0.05)',
              }}>
                <Upload size={24} color="#818cf8" style={{ margin: '0 auto 0.4rem' }} />
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
                  P2P Direct File Transfer
                </h5>
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 0.75rem 0' }}>
                  Transfers directly to peers via WebRTC RTCDataChannel without server storage
                </p>
                <label style={{
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: '#fff', fontSize: '0.78rem', fontWeight: 700,
                  padding: '0.4rem 0.9rem', borderRadius: '0.5rem', cursor: 'pointer',
                  display: 'inline-block',
                }}>
                  Select File to Send
                  <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {/* Transferred Files List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px' }}>
                {incomingFiles.length === 0 && outgoingFiles.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', marginTop: '1rem' }}>
                    No files transferred in this session yet
                  </span>
                ) : (
                  <>
                    {incomingFiles.map((file) => (
                      <div key={file.id} style={{
                        background: 'rgba(255, 255, 255, 0.05)', padding: '0.6rem 0.75rem',
                        borderRadius: '0.6rem', border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block' }}>{file.name}</span>
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                              From {file.senderName} • {(file.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          {file.completed ? (
                            <a
                              href={file.downloadUrl}
                              download={file.name}
                              style={{
                                background: '#22c55e', color: '#fff', padding: '0.3rem 0.55rem',
                                borderRadius: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem',
                                fontSize: '0.72rem', textDecoration: 'none', fontWeight: 700,
                              }}
                            >
                              <Download size={12} /> Save
                            </a>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 700 }}>{file.progress}%</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {outgoingFiles.map((file) => (
                      <div key={file.id} style={{
                        background: 'rgba(255, 255, 255, 0.05)', padding: '0.6rem 0.75rem',
                        borderRadius: '0.6rem', border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block' }}>{file.name} (Sent)</span>
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: file.completed ? '#22c55e' : '#6366f1', fontWeight: 700 }}>
                            {file.completed ? 'Sent ✓' : `${file.progress}%`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Connected Participants List */}
          {activeTab === 'participants' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0.85rem', gap: '0.6rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                  {user?.name?.[0]?.toUpperCase() || 'Y'}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{user?.name} (You)</span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Host • Online</span>
                </div>
              </div>

              {participants.map((p) => (
                <div key={p.socketId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                    {p.userName?.[0]?.toUpperCase() || 'P'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{p.userName}</span>
                    <span style={{ fontSize: '0.7rem', color: '#22c55e', display: 'block' }}>Peer Connected</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Remote Video Stream Card Component
const RemoteVideoCard = ({ stream, participant }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{
      position: 'relative',
      background: '#131926',
      borderRadius: '1rem',
      overflow: 'hidden',
      aspectRatio: '16/9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />

      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        padding: '0.3rem 0.65rem',
        borderRadius: '0.5rem',
        fontSize: '0.78rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}>
        <span>{participant?.userName || 'Team Member'}</span>
      </div>
    </div>
  );
};

export default Meeting;

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass, User, Briefcase, MessageSquare, PlusCircle,
  LogOut, Rocket, Sun, Moon, MessageCircle, Video, Activity
} from 'lucide-react';
import NotificationsDropdown from './NotificationsDropdown';
import SystemHealthModal from './SystemHealthModal';

const Navbar = ({ onLogout, theme, toggleTheme }) => {
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);

  return (
    <>
      <nav className="navbar">
        <div className="nav-logo">
          <Rocket size={28} style={{ strokeWidth: 2.5 }} />
          <span>DevCollab</span>
        </div>

        <div className="nav-links">
          <NavLink to="/explore" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Compass size={18} /> Explore
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Briefcase size={18} /> Projects
          </NavLink>
          <NavLink to="/meeting/general-room" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Video size={18} /> Video Room
          </NavLink>
          <NavLink to="/requests" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <MessageSquare size={18} /> Requests
          </NavLink>
          <NavLink to="/chat" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <MessageCircle size={18} /> Chat
          </NavLink>
          <NavLink to="/add-project" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <PlusCircle size={18} /> New Post
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <User size={18} /> Profile
          </NavLink>

          {/* Real-Time Notifications Hub */}
          <NotificationsDropdown />

          {/* Distributed System Health Monitor Trigger */}
          <button
            onClick={() => setIsSystemModalOpen(true)}
            className="nav-item"
            title="Distributed Microservices Monitor"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#22c55e',
              borderRadius: '0.5rem',
              padding: '0.4rem 0.65rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              display: 'inline-block',
            }} />
            <Activity size={16} /> Cluster
          </button>

          <button onClick={toggleTheme} className="nav-item" title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? <Moon size={18} color="#facc15" /> : <Sun size={18} color="#fde047" />}
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button onClick={onLogout} className="nav-item">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </nav>

      {/* System Health Monitor Modal */}
      <SystemHealthModal
        isOpen={isSystemModalOpen}
        onClose={() => setIsSystemModalOpen(false)}
      />
    </>
  );
};

export default Navbar;

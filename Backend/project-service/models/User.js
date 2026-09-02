const mongoose = require('mongoose');

// User schema definition for population within Project Service
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String },
    bio: { type: String, default: '' },
    skills: { type: [String], default: [] },
    github: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    avatar: { type: String, default: '' },
    ownedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    joinedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);

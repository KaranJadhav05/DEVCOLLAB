const mongoose = require('mongoose');

// Project schema reference for population within Auth Service
const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    techStack: { type: [String], default: [] },
    lookingFor: { type: [String], default: [] },
    domain: { type: String, default: 'General' },
    status: { type: String, default: 'Not Started' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);

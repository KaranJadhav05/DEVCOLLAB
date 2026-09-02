const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/devcollab";
    const conn = await mongoose.connect(mongoUri);
    console.log(`✅ [Notification Service] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ [Notification Service] MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

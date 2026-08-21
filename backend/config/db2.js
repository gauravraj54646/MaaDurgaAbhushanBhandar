const mongoose = require('mongoose');

const connectDB2 = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI2);
    console.log(`MongoDB Connected Successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB2;

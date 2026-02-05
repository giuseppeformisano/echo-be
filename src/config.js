require("dotenv").config({ path: __dirname + "/../.env" });
const fs = require("fs");
const path = require("path");

module.exports = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DAILY_API_KEY: process.env.DAILY_API_KEY,
  
  // SSL/TLS Configuration
  getServerOptions: function() {
    if (this.NODE_ENV === "production") {
      return null;
    }
    
    const certPath = path.join(__dirname, "../cert");
    return {
      key: fs.readFileSync(path.join(certPath, "localhost+2-key.pem")),
      cert: fs.readFileSync(path.join(certPath, "localhost+2.pem")),
    };
  },

  // Socket.IO Configuration
  socketIOConfig: {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  },

  // Daily.co API Configuration
  dailyApi: {
    baseUrl: "https://api.daily.co/v1",
    roomExpirySeconds: 3600, // 1 hour
  },
};

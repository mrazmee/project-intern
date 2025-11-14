// src/config/env.js
require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
};
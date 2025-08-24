// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const db = require('./models'); // expects index.js exporting sequelize and models
const assessmentRoutes = require('./routes/AssessmentRouter'); // central router that aggregates all resource routes
const institueRoutes = require('./routes/InstituteRouter');
const batchroutes = require('./routes/BatchRouter');
const userRoutes = require('./routes/UserRouter');
const assessmentAssignmentRoutes = require('./routes/AssessmentAssignmentRouter');
const AttemptRouter = require('./routes/AttemptRouter');


const app = express();

// Core middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API routes (single aggregated router)
app.use('/api', assessmentRoutes);
app.use('/api', institueRoutes);
app.use('/api', batchroutes);
app.use('/api', userRoutes);
app.use('/api', assessmentAssignmentRoutes);
app.use('/api', AttemptRouter);

// 404 handler for unknown routes
app.use((req, res, next) => {
  return res.status(404).json({ error: 'NotFound', path: req.originalUrl });
});

// Centralized error handler (fallback)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'InternalServerError' });
});

// Start server after DB is ready
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Prefer authenticate() here; manage schema via migrations
    await db.sequelize.authenticate();
    // await db.sequelize.sync({force:true}); // avoid in production

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
}

start();

module.exports = app;

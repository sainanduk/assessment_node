// routes/proctoringRoutes.js
const express = require('express');
const router = express.Router();

module.exports = (dependencies) => {
  const ProctoringLogController = require('../controllers/ProctoringLogController');
  const proctoringController = new ProctoringLogController(dependencies);

  // Save proctoring logs and check thresholds
  router.post('/logs', proctoringController.saveProctoringLogs);

  return router;
};


// // POST /api/proctoring/logs
// {
//   "attemptId": 12345,
//   "logs": [
//     {
//       "eventType": "tab_switch",
//       "timestamp": "2025-08-17T12:15:30Z",
//       "metadata": { "url": "https://google.com" }
//     },
//     {
//       "eventType": "face_not_detected",
//       "timestamp": "2025-08-17T12:16:45Z",
//       "metadata": { "duration": 5000 }
//     }
//   ]
// }

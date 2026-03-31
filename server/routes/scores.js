const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getLeaderboard, getUserStats, getGameHistory } = require('../db/queries');

const router = express.Router();

// GET /leaderboard — public
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard();
    return res.status(200).json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stats — protected
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await getUserStats(req.user.id);
    return res.status(200).json({ stats });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /history — protected
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const history = await getGameHistory(req.user.id);
    return res.status(200).json({ history });
  } catch (err) {
    console.error('History error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, updateDetails, updatePassword, deleteAccount } = require('../controllers/authController');
const {protect} = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.delete('/delete', protect, deleteAccount);

module.exports = router;
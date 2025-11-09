import express from 'express';
import { createUser, getUserById, searchUsers } from '../controllers/user.mjs';
import { upload } from '../upload/upload.mjs';
import { optionalAuthMiddleware } from '../auth/optionalAuth.mjs';
const router = express.Router();

router.post("/create-user", upload.single("avatar"), createUser)
router.get("/search-users", optionalAuthMiddleware, searchUsers)
router.get("/get-users/:userId", optionalAuthMiddleware, getUserById);

export default router;
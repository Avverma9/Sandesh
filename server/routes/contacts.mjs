import { Router } from "express";
import User from "../models/user.mjs";
import FriendRequest from "../models/contacts.mjs"; // Renamed from UserContact
import { authMiddleware } from "../auth/jwt.mjs";

const router = Router();

router.post("/send-request", authMiddleware, async (req, res) => {
  try {
    const rawEmail = req.body?.recipientEmail || req.body?.email;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined;

    if (!email) {
      return res.status(400).json({ message: "recipientEmail is required" });
    }

    const senderId = req.user.userId;
    const recipient = await User.findOne({ email });

    if (!recipient) {
      return res.status(404).json({ message: "User not found" });
    }

    if (senderId === recipient.id) {
      return res
        .status(400)
        .json({ message: "Cannot send request to yourself" });
    }

    // Check if they are already friends or if request is already sent
    const sender = await User.findById(senderId);
    if (sender.contacts.includes(recipient.id)) {
      return res.status(400).json({ message: "Already in contacts" });
    }

    // Check if request is already in sentRequests array
    if (sender.sentRequests && sender.sentRequests.includes(recipient.id)) {
      return res.status(400).json({ message: "Friend request already sent" });
    }

    // Check for existing pending request
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: senderId, recipient: recipient.id },
        { sender: recipient.id, recipient: senderId },
      ],
    });

    if (existingRequest) {
      return res
        .status(400)
        .json({ message: "Friend request already sent or received" });
    }

    // Create the friend request
    const newRequest = await FriendRequest.create({
      sender: senderId,
      recipient: recipient.id,
    });

    // Add recipient to sender's sentRequests array
    sender.sentRequests.push(recipient.id);
    await sender.save();

    res.status(201).json({
      message: "Friend request sent successfully",
      recipient: {
        id: recipient.id,
        username: recipient.username,
        email: recipient.email,
      },
    });
  } catch (error) {
    console.error("Error sending friend request:", error);
    res.status(500).json({
      message: "Failed to send friend request",
      error: error.message,
    });
  }
});

router.post("/accept-request/:senderId", authMiddleware, async (req, res) => {
  try {
    const { senderId } = req.params;
    const receiverId = req.user.userId;

    if (!senderId || senderId === receiverId) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const request = await FriendRequest.findOne({
      sender: senderId,
      recipient: receiverId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId),
    ]);

    // Add to contacts
    sender.contacts.push(receiverId);
    receiver.contacts.push(senderId);

    // Remove from sentRequests
    sender.sentRequests = sender.sentRequests.filter(
      (id) => id.toString() !== receiverId
    );

    await Promise.all([
      sender.save(),
      receiver.save(),
      request.deleteOne(), // or request.remove()
    ]);

    const newContact = await User.findById(
      senderId,
      "id username email isOnline bio"
    );

    res.json({
      message: "Friend request accepted",
      contact: newContact,
    });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    res.status(500).json({
      message: "Failed to accept friend request",
      error: error.message,
    });
  }
});

// Decline (reject) a friend request -- receiver rejects a pending request
router.post("/decline-request/:senderId", authMiddleware, async (req, res) => {
  try {
    const { senderId } = req.params;
    const receiverId = req.user.userId;

    if (!senderId || senderId === receiverId) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const request = await FriendRequest.findOne({
      sender: senderId,
      recipient: receiverId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    await request.deleteOne();

    // Remove receiver from sender's sentRequests array
    const sender = await User.findById(senderId);
    if (sender) {
      sender.sentRequests = sender.sentRequests.filter(
        (id) => id.toString() !== receiverId
      );
      await sender.save();
    }

    return res.json({ message: "Friend request declined" });
  } catch (error) {
    console.error("Error declining friend request:", error);
    res
      .status(500)
      .json({
        message: "Failed to decline friend request",
        error: error.message,
      });
  }
});

// Withdraw a sent friend request -- sender cancels a pending request
router.post(
  "/withdraw-request/:recipientId",
  authMiddleware,
  async (req, res) => {
    try {
      const { recipientId } = req.params;
      const senderId = req.user.userId;

      if (!recipientId || recipientId === senderId) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const request = await FriendRequest.findOne({
        sender: senderId,
        recipient: recipientId,
        status: "pending",
      });

      if (!request) {
        return res.status(404).json({ message: "Friend request not found" });
      }

      // Delete the request
      await request.deleteOne();

      // Remove recipient from sender's sentRequests array
      const sender = await User.findById(senderId);
      if (sender) {
        sender.sentRequests = sender.sentRequests.filter(
          (id) => id.toString() !== recipientId
        );
        await sender.save();
      }

      return res.json({ message: "Friend request withdrawn" });
    } catch (error) {
      console.error("Error withdrawing friend request:", error);
      res
        .status(500)
        .json({
          message: "Failed to withdraw friend request",
          error: error.message,
        });
    }
  }
);

router.get("/pending-requests", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const pendingRequests = await FriendRequest.find({
      recipient: userId,
      status: "pending",
    });
    const findRecipientsNameAndSenderName = await Promise.all(
      pendingRequests.map(async (request) => {
        const sender = await User.findById(request.sender).select(
          "id username email images"
        );
        return {
          requestId: request.id,
          sender: sender,
        };
      })
    );
    res.json(findRecipientsNameAndSenderName);
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json({
      message: "Failed to fetch pending requests",
      error: error.message,
    });
  }
});

router.get("/getcontacts", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).populate(
      "contacts",
      "id username email isOnline bio images"
    );

    if (!user) return res.status(404).json({ message: "User not found" });
    const contacts = user.contacts || [];

    res.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({
      message: "Failed to fetch contacts",
      error: error.message,
    });
  }
});

// Check relationship status with a specific user
router.get("/check-status/:userId", authMiddleware, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.userId;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user ID required" });
    }

    if (targetUserId === currentUserId) {
      return res
        .status(400)
        .json({ message: "Cannot check relationship with yourself" });
    }

    // Get current user
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    // Check if they are friends already
    if (currentUser.contacts.includes(targetUserId)) {
      return res.json({
        status: "accepted",
        message: "Users are already friends",
      });
    }

    // Check for pending requests - first check sentRequests array
    if (
      currentUser.sentRequests &&
      currentUser.sentRequests.includes(targetUserId)
    ) {
      return res.json({
        status: "pending",
        message: "Friend request already sent",
      });
    }

    // Fallback to checking the FriendRequest collection
    const pendingSentRequest = await FriendRequest.findOne({
      sender: currentUserId,
      recipient: targetUserId,
      status: "pending",
    });

    if (pendingSentRequest) {
      return res.json({
        status: "pending",
        message: "Friend request already sent",
      });
    }

    const pendingReceivedRequest = await FriendRequest.findOne({
      sender: targetUserId,
      recipient: currentUserId,
      status: "pending",
    });

    if (pendingReceivedRequest) {
      return res.json({
        status: "received",
        message: "Friend request received from this user",
      });
    }

    // No relationship exists
    return res.json({
      status: "none",
      message: "No relationship exists between users",
    });
  } catch (error) {
    console.error("Error checking relationship status:", error);
    res.status(500).json({
      message: "Failed to check relationship status",
      error: error.message,
    });
  }
});

export default router;

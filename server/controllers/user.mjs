import { asyncHandler } from "../asyncHandler.mjs";
import User from "../models/user.mjs";
import FriendRequest from "../models/contacts.mjs";

export const createUser = asyncHandler(async (req, res) => {
  const { username, email, mobile, bio } = req.body;
  const images = req.files ? req.files.map((f) => f.location) : [];

  if (!username) {
    return res
      .status(400)
      .json({ success: false, message: "Username is required" });
  }

  if (email) {
    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }
  }

  const capitalizedUsername =
    username.charAt(0).toUpperCase() + username.slice(1);

  const user = await User.create({
    username: capitalizedUsername,
    email,
    mobile,
    images,
    bio,
  });

  res.status(201).json({ success: true, user });
});

export const searchUsers = asyncHandler(async (req, res) => {
  const { query } = req.query;
  const queryRegex = new RegExp(query.trim(), "i");

  const users = await User.find({
    $or: [
      { username: queryRegex },
      { email: queryRegex },
      { mobile: queryRegex },
    ],
  });
  const findSentRequests = await FriendRequest.find({ sender: req.user.userId });
  
  res.json({ success: true, users: users, sentRequests: findSentRequests });

});

export const addContact = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    return res
      .status(400)
      .json({ success: false, message: "contactId is required" });
  }
  if (String(userId) === String(contactId)) {
    return res
      .status(400)
      .json({ success: false, message: "Cannot add yourself as a contact" });
  }

  const [user, contact] = await Promise.all([
    User.findById(userId),
    User.findById(contactId),
  ]);
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });
  if (!contact)
    return res
      .status(404)
      .json({ success: false, message: "Contact user not found" });

  const already = (user.contacts || [])
    .map(String)
    .includes(String(contact.id));
  if (already) {
    return res
      .status(200)
      .json({ success: true, message: "Contact already added" });
  }

  user.contacts = [...(user.contacts || []), contact.id];
  await user.save();

  const pick = ({ id, username, email, mobile, images, bio }) => ({
    id,
    username,
    email,
    mobile,
    images,
    bio,
  });
  res
    .status(201)
    .json({ success: true, message: "Contact added", contact: pick(contact) });
});

export const getContacts = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).populate(
    "contacts",
    "id username email mobile images bio"
  );
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });

  res.json({ success: true, contacts: user.contacts || [] });
});


export const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });

  res.json({ success: true, user });
});
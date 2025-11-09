import User from '../models/user.mjs';
import FriendRequest from '../models/contacts.mjs';

/**
 * Utility function to synchronize a user's sentRequests array with actual 
 * friend request records in the database. This helps keep the sentRequests
 * array in sync with the FriendRequest collection.
 * 
 * @param {string} userId - The ID of the user whose sentRequests need to be synced
 * @returns {Promise<boolean>} - Returns true if sync was successful
 */
export const syncSentRequests = async (userId) => {
  try {
    // Find the user
    const user = await User.findById(userId);
    if (!user) return false;
    
    // Get all pending requests sent by this user
    const sentRequests = await FriendRequest.find({
      sender: userId,
      status: 'pending'
    });
    
    // Get recipient IDs from sent requests
    const recipientIds = sentRequests.map(request => request.recipient.toString());
    
    // Update user's sentRequests array
    user.sentRequests = recipientIds;
    await user.save();
    
    return true;
  } catch (error) {
    console.error('Error syncing sent requests:', error);
    return false;
  }
};

/**
 * Batch sync for multiple users or all users
 * @param {Array<string>} userIds - Optional array of user IDs to sync, if not provided syncs all users
 */
export const batchSyncSentRequests = async (userIds = null) => {
  try {
    const query = userIds ? { _id: { $in: userIds } } : {};
    const users = await User.find(query);
    
    const results = await Promise.all(
      users.map(user => syncSentRequests(user._id))
    );
    
    return {
      total: users.length,
      successful: results.filter(r => r).length
    };
  } catch (error) {
    console.error('Error in batch sync:', error);
    return { total: 0, successful: 0, error: error.message };
  }
};

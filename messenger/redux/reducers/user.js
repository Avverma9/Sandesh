import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../util/api";
import { setTokens, clearTokens, fetchMe } from "../../util/auth";
import { setSocketAuthToken } from "../../util/socket";

export const createUser = createAsyncThunk(
  "user/createUser",
  async (userData, thunkAPI) => {
    try {
      const { data } = await api.post("/users/create-user", userData);
      if (data?.accessToken || data?.refreshToken) {
        setTokens(data.accessToken || null, data.refreshToken || null);
        // update socket auth so socket can use the new access token
        try {
          setSocketAuthToken(data.accessToken || null);
        } catch (e) {}
        // try to fetch /me and attach it to the returned payload
        try {
          const me = await fetchMe();
          return { ...data, me };
        } catch (e) {
          // ignore
        }
      }
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

export const searchUsers = createAsyncThunk(
  "user/searchUsers",
  async (query, thunkAPI) => {
    try {
      const { data } = await api.get(`/users/search-users?query=${encodeURIComponent(query)}`);
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

export const sendRequest = createAsyncThunk(
  "user/sendRequest",
  async (requestData, thunkAPI) => {
    try {
      const { data } = await api.post("/contacts/send-request", requestData);
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

  export const getPendingRequests = createAsyncThunk(
    "user/getPendingRequests",
    async (_, thunkAPI) => {
      try {
        const { data } = await api.get("/contacts/pending-requests");
        return data;
      } catch (err) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
        return thunkAPI.rejectWithValue(msg);
      }
    }
  );

  export const declineRequest = createAsyncThunk(
    "user/declineRequest",
    async (userId, thunkAPI) => {
      try {
        const { data } = await api.post(`/contacts/decline-request/${userId}`);
        // return both message data and userId so reducer can remove it from pendingRequests
        return { data, userId };
      } catch (err) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
        return thunkAPI.rejectWithValue(msg);
      }
    }
  );

  export const withdrawRequest = createAsyncThunk(
    "user/withdrawRequest",
    async (userId, thunkAPI) => {
      try {
        const { data } = await api.post(`/contacts/withdraw-request/${userId}`);
        return { data, userId };
      } catch (err) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
        return thunkAPI.rejectWithValue(msg);
      }
    }
  );


export const acceptRequests = createAsyncThunk(
  "user/acceptRequests",
  async (userId, thunkAPI) => {
    try {
      const { data } = await api.post(`/contacts/accept-request/${userId}`);
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

export const getContacts = createAsyncThunk(
  "user/getContacts",
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get("/contacts/getcontacts");
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

export const getUserById = createAsyncThunk(
  "user/getUserById",
  async (userId, thunkAPI) => {
    try {
      const { data } = await api.get(`/users/get-users/${userId}`);
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);


export const loginUser = createAsyncThunk(
  "user/loginUser",
  async (credentials, thunkAPI) => {
    try {
      const { data } = await api.post("/auth/send-otp", credentials);
      if (data?.accessToken || data?.refreshToken) {
        setTokens(data.accessToken || null, data.refreshToken || null);
        // update socket auth so socket can use the new access token
        try {
          setSocketAuthToken(data.accessToken || null);
        } catch (e) {}
        // fetch /me after storing tokens so we have the current user info
        try {
          const me = await fetchMe();
          return { ...data, me };
        } catch (e) {
          // ignore failures to fetch /me, still return login data
          return data;
        }
      }
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

export const verifyOtp = createAsyncThunk(
  "user/verifyOtp",
  async (otpData, thunkAPI) => {
    try {
      const { data } = await api.post("/auth/verify-otp", { ...otpData });
      if (data?.accessToken || data?.refreshToken) {
        setTokens(data.accessToken || null, data.refreshToken || null);
        // update socket auth so socket can use the new access token
        try {
          setSocketAuthToken(data.accessToken || null);
        } catch (e) {}
        // fetch /me after storing tokens to populate local state
        try {
          const me = await fetchMe();
          return { ...data, me };
        } catch (e) {
          return data;
        }
      }
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

const initialState = {
  userInfo: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  loadingCreate: false,
  loadingLogin: false,
  loadingVerify: false,
  loadingSearch: false,
  loadingRequest: false,
  loadingDecline: false,
  loadingWithdraw: false,
  loadingPendingRequests: false,
  loadingContacts: false,
  loadingUserById: false,
  selectedUser: null,
  searchResults: null,
  lastRequestResult: null,
  pendingRequests: [],
  contacts: [],
  error: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    logout(state) {
      state.userInfo = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.searchResults = null;
      state.lastRequestResult = null;
      state.pendingRequests = [];
      state.error = null;
      clearTokens();
    },
    setUser(state, action) {
      state.userInfo = action.payload || null;
      state.isAuthenticated = !!action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createUser.pending, (state) => {
        state.loadingCreate = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.loadingCreate = false;
  state.userInfo = action.payload?.me?.user || action.payload?.me || action.payload?.user || action.payload || null;
        state.accessToken = action.payload?.accessToken || state.accessToken;
        state.refreshToken = action.payload?.refreshToken || state.refreshToken;
        state.isAuthenticated = !!(state.accessToken || state.userInfo);
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loadingCreate = false;
        state.error = action.payload || "Failed to create user";
      })

      .addCase(loginUser.pending, (state) => {
        state.loadingLogin = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loadingLogin = false;
  state.userInfo = action.payload?.me?.user || action.payload?.me || action.payload?.user || state.userInfo;
        state.accessToken = action.payload?.accessToken || state.accessToken;
        state.refreshToken = action.payload?.refreshToken || state.refreshToken;
        state.isAuthenticated = !!(state.accessToken || state.userInfo);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loadingLogin = false;
        state.error = action.payload || "Login failed";
      })

      .addCase(verifyOtp.pending, (state) => {
        state.loadingVerify = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loadingVerify = false;
        state.accessToken = action.payload?.accessToken || null;
        state.refreshToken = action.payload?.refreshToken || null;
  state.userInfo = action.payload?.me?.user || action.payload?.me || action.payload?.user || state.userInfo;
        state.isAuthenticated = !!state.accessToken;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loadingVerify = false;
        state.error = action.payload || "OTP verification failed";
      })

      .addCase(searchUsers.pending, (state) => {
        state.loadingSearch = true;
        state.error = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.loadingSearch = false;
        state.searchResults = action.payload?.users ?? action.payload ?? [];
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.loadingSearch = false;
        state.error = action.payload || "Search failed";
      })

      .addCase(sendRequest.pending, (state) => {
        state.loadingRequest = true;
        state.error = null;
      })
      .addCase(sendRequest.fulfilled, (state, action) => {
        state.loadingRequest = false;
        state.lastRequestResult = action.payload || { success: true };
      })
      .addCase(sendRequest.rejected, (state, action) => {
        state.loadingRequest = false;
        state.error = action.payload || "Action failed";
      })

      // Decline a received pending request (receiver rejects)
      .addCase(declineRequest.pending, (state) => {
        state.loadingDecline = true;
        state.error = null;
      })
      .addCase(declineRequest.fulfilled, (state, action) => {
        state.loadingDecline = false;
        // action.payload: { data, userId }
        state.lastRequestResult = action.payload?.data || { success: true };
        // remove from pendingRequests by matching id
        const rid = action.payload?.userId;
        if (rid) {
          state.pendingRequests = state.pendingRequests.filter(
            (r) => String(r.id) !== String(rid)
          );
        }
      })
      .addCase(declineRequest.rejected, (state, action) => {
        state.loadingDecline = false;
        state.error = action.payload || "Action failed";
      })

      // Withdraw a sent pending request (sender cancels)
      .addCase(withdrawRequest.pending, (state) => {
        state.loadingWithdraw = true;
        state.error = null;
      })
      .addCase(withdrawRequest.fulfilled, (state, action) => {
        state.loadingWithdraw = false;
        state.lastRequestResult = action.payload?.data || { success: true };
        const rid = action.payload?.userId;
        if (rid) {
          state.pendingRequests = state.pendingRequests.filter(
            (r) => String(r.id) !== String(rid)
          );
        }
      })
      .addCase(withdrawRequest.rejected, (state, action) => {
        state.loadingWithdraw = false;
        state.error = action.payload || "Action failed";
      })

      .addCase(getPendingRequests.pending, (state) => {
        state.loadingPendingRequests = true;
        state.error = null;
      })
      .addCase(getPendingRequests.fulfilled, (state, action) => {
        state.loadingPendingRequests = false;
        state.pendingRequests = action.payload?.requests ?? action.payload ?? [];
      })
      .addCase(getPendingRequests.rejected, (state, action) => {
        state.loadingPendingRequests = false;
        state.error = action.payload || "Failed to fetch pending requests";
      })
      .addCase(getContacts.pending, (state) => {
        state.loadingContacts = true;
        state.error = null;
      })
      .addCase(getContacts.fulfilled, (state, action) => {
        state.loadingContacts = false;
        state.contacts = action.payload?.contacts ?? action.payload ?? [];
      })
      .addCase(getContacts.rejected, (state, action) => {
        state.loadingContacts = false;
        state.error = action.payload || "Failed to fetch contacts";
      })
      
      .addCase(getUserById.pending, (state) => {
        state.loadingUserById = true;
        state.error = null;
      })
      .addCase(getUserById.fulfilled, (state, action) => {
        state.loadingUserById = false;
        state.selectedUser = action.payload?.user || null;
      })
      .addCase(getUserById.rejected, (state, action) => {
        state.loadingUserById = false;
        state.error = action.payload || "Failed to fetch user details";
      });
  },
});

export const { logout, setUser, clearError } = userSlice.actions;
export default userSlice.reducer;

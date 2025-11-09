// Token storage and retrieval helpers
export const getAccessToken = () => localStorage.getItem("accessToken") || "";
export const getRefreshToken = () => localStorage.getItem("refreshToken") || "";

export const setTokens = (accessToken, refreshToken) => {
  if (accessToken) localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
};

export const authHeader = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};


export const fetchMe = async () => {
  try {
    // Import api here to avoid circular dependencies
    const api = (await import('./api')).default;
    const { data } = await api.get("/me");
    console.log("Fetched /me data:", data);
    return data;
  } catch (err) {
    console.error("Failed to fetch /me:", err);
    throw err;
  }
};

// Check if access token exists and is not expired (client-side check)
export const isAccessTokenValid = () => {
  const token = getAccessToken();
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // atob is available in browser
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    console.log("Token payload:", payload);
    if (!payload || !payload.exp) return false;
    // exp is in seconds
    return payload.exp * 1000 > Date.now();
  } catch (err) {
    return false;
  }
};



export const currentUserId = localStorage.getItem("loggedInUserId") || "";
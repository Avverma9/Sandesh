# Google Sign-In Integration Guide

This guide walks through the full frontend flow for authenticating users with Google and exchanging the Google ID token for the Sandesh session tokens via `/auth/google-login`.

---

## 1. Prerequisites
- Google Cloud OAuth 2.0 Web client created at https://console.cloud.google.com/apis/credentials
- `GOOGLE_CLIENT_ID` from the Google console configured in both:
  - Frontend (used by Google Identity Services SDK)
  - Backend (`.env` → `GOOGLE_CLIENT_ID=...`)
- If you maintain separate web, Android, or iOS OAuth clients, list every client ID in `GOOGLE_CLIENT_ID` separated by commas on the backend.
- HTTPS domain or localhost with correct origins added to the Google OAuth client

---

## 2. Install Google Identity Services

### Web (React/Vite/Next.js)
```bash
npm i @react-oauth/google
```
or load the script tag directly:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### React Native / Expo
Use `@react-native-google-signin/google-signin`:
```bash
npm i @react-native-google-signin/google-signin
```
Then follow the platform-specific setup in their documentation (SHA1 certificate, URL schemes, etc.).

---

## 3. Web Implementation (Fetch Flow)

```tsx
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GoogleButton() {
  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;

    const res = await fetch('https://your-backend.com/api/auth/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // allow cookies to be set by the backend
      body: JSON.stringify({ credential: credentialResponse.credential })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Google login failed', data);
      return;
    }

    // Access + refresh tokens are also returned in JSON if you need to store them manually.
    console.log('Logged in user', data.user);
  };

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleLogin onSuccess={handleSuccess} onError={() => console.error('Login Failed')} />
    </GoogleOAuthProvider>
  );
}
```

### Notes
- `credentials: 'include'` ensures the backend can drop `accessToken` and `refreshToken` cookies (same flow as OTP verification).
- If you run the backend locally at `http://localhost:5000`, configure frontend dev proxy or set `VITE_API_URL` accordingly.
- Handle errors (HTTP 401 for invalid token, 500 for config issues) and prompt the user to retry or pick another account.

---

## 4. React Native / Expo Flow

```ts
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  offlineAccess: true,
});

export async function googleLogin() {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const { idToken } = await GoogleSignin.signIn();
    if (!idToken) throw new Error('Missing Google ID token');

    const response = await fetch('https://your-backend.com/api/auth/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: idToken }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Google login failed');
    }

    // For mobile apps you may want to store access token yourself since cookies are not used.
    await AsyncStorage.setItem('accessToken', data.accessToken);
    await AsyncStorage.setItem('refreshToken', data.refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));

    return data.user;
  } catch (error) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return null; // user aborted
    }
    throw error;
  }
}
```

### Cookie vs Token Storage
- Web: rely on HTTP-only cookies set by the backend (more secure).
- Native: cookies are not automatically persisted. Use secure storage (Keychain/Keystore) for tokens.

---

## 5. Backend Endpoint Expectations
```
POST /api/auth/google-login
Content-Type: application/json
Body: { "credential": "<Google ID token>" }
Response 200:
{
  "message": "Google login successful",
  "user": { ...user fields... },
  "accessToken": "...", // optional for web
  "refreshToken": "..."
}
```
- Sets `accessToken` and `refreshToken` cookies mirroring the OTP verification flow.
- Automatically creates a user if the Google email does not yet exist.
- Attaches the Google profile picture if available and no avatar is stored yet.

---

## 6. Logout Handling
- Web: call `fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })` (implement if not already present) and revoke Google session with `google.accounts.id.disableAutoSelect()`.
- Mobile: remove stored tokens, optionally call `GoogleSignin.signOut()`.

---

## 7. Troubleshooting
- **Invalid token (401)**: ensure you pass the ID token returned by Google and that your `GOOGLE_CLIENT_ID` matches between client and server.
- **Wrong recipient / audience mismatch**: add the Google client ID used by the caller to `GOOGLE_CLIENT_ID` (comma-separated for multiple clients).
- **Email not verified (403)**: user must verify their Google account email.
- **CORS issues**: whitelist frontend origin on the backend CORS config; use `credentials: true`.
- **Cookies missing on web**: confirm HTTPS, matching domain, and `credentials: 'include'` flag.

Follow these steps to integrate Google Sign-In and issue the same session tokens the OTP flow uses.

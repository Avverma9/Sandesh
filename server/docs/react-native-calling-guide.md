# React Native Audio & Video Calling Implementation Guide

Complete guide for implementing WebRTC-based audio and video calling in React Native mobile app with Socket.IO signaling.

---

## 📦 Required Packages

```bash
npm install react-native-webrtc socket.io-client @react-native-async-storage/async-storage
npm install react-native-incall-manager # For audio routing and proximity sensor
```

### iOS Setup (after installing packages)
```bash
cd ios && pod install && cd ..
```

Add permissions to `ios/YourApp/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>We need microphone access for calls</string>
```

### Android Setup
Add permissions to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

---

## 🔌 Socket.IO Connection Setup

### `services/socket.js`
```javascript
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

let socket = null;

export const connectSocket = async () => {
  const token = await AsyncStorage.getItem('accessToken');
  
  if (!token) {
    console.error('No access token found');
    return null;
  }

  socket = io('http://192.168.29.81:5000', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
    console.log('[SOCKET] Auth token present:', !!socket.auth?.token);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
    console.error('[SOCKET] Check if token is valid and server is running');
  });

  return socket;
};

export const getSocket = () => {
  if (!socket || !socket.connected) {
    console.warn('Socket not connected. Call connectSocket() first.');
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
```

---

## 📞 WebRTC Call Service

### `services/CallService.js`
```javascript
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import { getSocket } from './socket';
import InCallManager from 'react-native-incall-manager';

class CallService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCallId = null;
    this.isCaller = false;
    
    // Callbacks
    this.onLocalStream = null;
    this.onRemoteStream = null;
    this.onCallEnded = null;
    this.onIncomingCall = null;
  }

  // ICE servers configuration
  getIceServers() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    };
  }

  // Initialize Socket listeners
  initializeSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    console.log('[CALL] Initializing socket listeners for calling');

    // Incoming call
    socket.on('incomingCall', ({ callId, callerId, callType, caller }) => {
      console.log('[CALL] 📞 Incoming call received!');
      console.log('[CALL] - callId:', callId);
      console.log('[CALL] - callerId:', callerId);
      console.log('[CALL] - callType:', callType);
      console.log('[CALL] - caller:', caller?.username);
      
      this.currentCallId = callId;
      this.isCaller = false;
      
      if (this.onIncomingCall) {
        this.onIncomingCall({ callId, callerId, callType, caller });
      } else {
        console.warn('[CALL] ⚠️ onIncomingCall callback is not set!');
      }
    });

    // Call accepted by receiver
    socket.on('callAccepted', async ({ callId, receiverId }) => {
      console.log('✅ Call accepted by receiver');
      // Caller creates and sends offer
      await this.createOffer(receiverId);
    });

    // Call rejected
    socket.on('callRejected', ({ callId }) => {
      console.log('❌ Call rejected');
      this.endCall();
    });

    // Call ended by other party
    socket.on('callEnded', ({ callId, endedBy }) => {
      console.log('📵 Call ended by:', endedBy);
      this.endCall();
    });

    // WebRTC signaling - Receive Offer
    socket.on('receiveOffer', async ({ offer, from, callId }) => {
      console.log('📩 Received offer from:', from);
      await this.handleOffer(offer, from, callId);
    });

    // WebRTC signaling - Receive Answer
    socket.on('receiveAnswer', async ({ answer, from, callId }) => {
      console.log('📩 Received answer from:', from);
      await this.handleAnswer(answer);
    });

    // WebRTC signaling - Receive ICE Candidate
    socket.on('receiveIceCandidate', async ({ candidate, from, callId }) => {
      console.log('🧊 Received ICE candidate from:', from);
      await this.handleIceCandidate(candidate);
    });

    // User not available
    socket.on('userNotAvailable', ({ message }) => {
      console.log('⚠️ User not available:', message);
      alert('User is offline or unavailable');
      this.endCall();
    });

    // Call errors
    socket.on('callError', ({ error }) => {
      console.error('❌ Call error:', error);
      alert(`Call error: ${error}`);
      this.endCall();
    });
  }

  // Start a call (initiate)
  async startCall(receiverId, callType = 'video') {
    try {
      console.log(`[CALL] 🚀 Starting ${callType} call to:`, receiverId);
      this.isCaller = true;

      // Request media permissions
      await this.getLocalStream(callType);

      // Initialize peer connection
      this.initializePeerConnection();

      // Emit initiateCall to server
      const socket = getSocket();
      console.log('[CALL] Emitting initiateCall event to server');
      console.log('[CALL] - receiverId:', receiverId);
      console.log('[CALL] - callType:', callType);
      
      socket.emit('initiateCall', { receiverId, callType });

      // Listen for callInitiated confirmation
      socket.once('callInitiated', ({ callId, receiverId: rid, callType: ct }) => {
        console.log('[CALL] ✅ Call initiated, callId:', callId);
        this.currentCallId = callId;
      });

      // Start InCallManager
      InCallManager.start({ media: callType, auto: true });
      
    } catch (error) {
      console.error('[CALL] ❌ Error starting call:', error);
      this.endCall();
      throw error;
    }
  }

  // Get local media stream
  async getLocalStream(callType) {
    try {
      const isFront = true;
      const constraints = {
        audio: true,
        video: callType === 'video' ? {
          mandatory: {
            minWidth: 640,
            minHeight: 480,
            minFrameRate: 30,
          },
          facingMode: isFront ? 'user' : 'environment',
        } : false,
      };

      this.localStream = await mediaDevices.getUserMedia(constraints);
      
      if (this.onLocalStream) {
        this.onLocalStream(this.localStream);
      }

      return this.localStream;
    } catch (error) {
      console.error('Error getting local stream:', error);
      throw error;
    }
  }

  // Initialize RTCPeerConnection
  initializePeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.getIceServers());

    // Add local stream tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('🎥 Remote stream received');
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate');
        const socket = getSocket();
        socket.emit('sendIceCandidate', {
          to: this.isCaller ? this.receiverUserId : this.callerUserId,
          candidate: event.candidate,
          callId: this.currentCallId,
        });
      }
    };

    // Connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'disconnected' ||
          this.peerConnection.connectionState === 'failed') {
        this.endCall();
      }
    };
  }

  // Accept incoming call
  async acceptCall(callId, callType = 'video') {
    try {
      console.log('✅ Accepting call:', callId);
      this.currentCallId = callId;

      // Get local stream
      await this.getLocalStream(callType);

      // Initialize peer connection
      this.initializePeerConnection();

      // Emit acceptCall to server
      const socket = getSocket();
      socket.emit('acceptCall', { callId });

      // Start InCallManager
      InCallManager.start({ media: callType, auto: true });

    } catch (error) {
      console.error('Error accepting call:', error);
      this.endCall();
      throw error;
    }
  }

  // Reject incoming call
  rejectCall(callId) {
    console.log('❌ Rejecting call:', callId);
    const socket = getSocket();
    socket.emit('rejectCall', { callId });
    this.cleanup();
  }

  // Create and send offer (caller side)
  async createOffer(receiverId) {
    try {
      this.receiverUserId = receiverId;
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.peerConnection.setLocalDescription(offer);

      console.log('📤 Sending offer');
      const socket = getSocket();
      socket.emit('sendOffer', {
        to: receiverId,
        offer: this.peerConnection.localDescription,
        callId: this.currentCallId,
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  // Handle incoming offer (receiver side)
  async handleOffer(offer, from, callId) {
    try {
      this.callerUserId = from;
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      console.log('📤 Sending answer');
      const socket = getSocket();
      socket.emit('sendAnswer', {
        to: from,
        answer: this.peerConnection.localDescription,
        callId,
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  // Handle incoming answer (caller side)
  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Answer set successfully');
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  // Handle incoming ICE candidate
  async handleIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // Toggle camera (front/back)
  async switchCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      videoTrack._switchCamera();
    }
  }

  // Toggle microphone
  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // Return muted state
    }
    return false;
  }

  // Toggle video
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // Return video off state
    }
    return false;
  }

  // End call
  endCall() {
    console.log('📵 Ending call');
    
    if (this.currentCallId) {
      const socket = getSocket();
      socket.emit('endCall', { callId: this.currentCallId });
    }

    this.cleanup();

    if (this.onCallEnded) {
      this.onCallEnded();
    }
  }

  // Cleanup resources
  cleanup() {
    // Stop InCallManager
    InCallManager.stop();

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Clear remote stream
    this.remoteStream = null;
    this.currentCallId = null;
    this.isCaller = false;
    this.receiverUserId = null;
    this.callerUserId = null;
  }
}

export default new CallService();
```

---

## 🎬 Call Screen Component

### `screens/CallScreen.js`
```javascript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import CallService from '../services/CallService';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

const CallScreen = ({ route, navigation }) => {
  const { receiverId, receiverName, callType, isIncoming, callId } = route.params;

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callConnected, setCallConnected] = useState(false);

  useEffect(() => {
    initializeCall();
    setupCallbacks();

    return () => {
      CallService.endCall();
    };
  }, []);

  const initializeCall = async () => {
    try {
      if (isIncoming) {
        // Accept incoming call
        await CallService.acceptCall(callId, callType);
      } else {
        // Start outgoing call
        await CallService.startCall(receiverId, callType);
      }
    } catch (error) {
      console.error('Call initialization error:', error);
      Alert.alert('Error', 'Failed to initialize call');
      navigation.goBack();
    }
  };

  const setupCallbacks = () => {
    CallService.onLocalStream = (stream) => {
      console.log('📹 Local stream set');
      setLocalStream(stream);
    };

    CallService.onRemoteStream = (stream) => {
      console.log('📹 Remote stream set');
      setRemoteStream(stream);
      setCallConnected(true);
    };

    CallService.onCallEnded = () => {
      console.log('Call ended callback');
      navigation.goBack();
    };
  };

  const handleEndCall = () => {
    CallService.endCall();
    navigation.goBack();
  };

  const handleToggleMute = () => {
    const muted = CallService.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleVideo = () => {
    const videoOff = CallService.toggleVideo();
    setIsVideoOff(videoOff);
  };

  const handleSwitchCamera = () => {
    CallService.switchCamera();
  };

  return (
    <View style={styles.container}>
      {/* Remote Video (Full Screen) */}
      {remoteStream && callType === 'video' ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
        />
      ) : (
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {receiverName?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
          <Text style={styles.nameText}>{receiverName || 'User'}</Text>
          <Text style={styles.statusText}>
            {callConnected ? 'Connected' : 'Calling...'}
          </Text>
        </View>
      )}

      {/* Local Video (Small Preview) */}
      {localStream && callType === 'video' && !isVideoOff && (
        <View style={styles.localVideoContainer}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={true}
          />
        </View>
      )}

      {/* Call Controls */}
      <View style={styles.controlsContainer}>
        {/* Mute Button */}
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.activeButton]}
          onPress={handleToggleMute}>
          <Icon
            name={isMuted ? 'mic-off' : 'mic'}
            size={28}
            color="#fff"
          />
        </TouchableOpacity>

        {/* End Call Button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}>
          <Icon name="call-end" size={32} color="#fff" />
        </TouchableOpacity>

        {/* Video Toggle (only for video calls) */}
        {callType === 'video' && (
          <TouchableOpacity
            style={[styles.controlButton, isVideoOff && styles.activeButton]}
            onPress={handleToggleVideo}>
            <Icon
              name={isVideoOff ? 'videocam-off' : 'videocam'}
              size={28}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {/* Switch Camera (only for video calls) */}
        {callType === 'video' && !isVideoOff && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleSwitchCamera}>
            <Icon name="flip-camera-ios" size={28} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
    width: width,
    height: height,
  },
  avatarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  avatarText: {
    fontSize: 80,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#4a90e2',
    width: 150,
    height: 150,
    borderRadius: 75,
    textAlign: 'center',
    lineHeight: 150,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
  },
  statusText: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 10,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#e74c3c',
  },
  endCallButton: {
    backgroundColor: '#e74c3c',
    width: 70,
    height: 70,
    borderRadius: 35,
  },
});

export default CallScreen;
```

---

## 📲 Incoming Call Screen

### `screens/IncomingCallScreen.js`
```javascript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const IncomingCallScreen = ({ route, navigation }) => {
  const { callId, callerId, callType, caller } = route.params;

  const handleAccept = () => {
    navigation.replace('CallScreen', {
      receiverId: callerId,
      receiverName: caller.username,
      callType,
      isIncoming: true,
      callId,
    });
  };

  const handleReject = () => {
    const CallService = require('../services/CallService').default;
    CallService.rejectCall(callId);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.callerInfo}>
        {caller.images?.[0] ? (
          <Image source={{ uri: caller.images[0] }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {caller.username?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <Text style={styles.callerName}>{caller.username || 'Unknown'}</Text>
        <Text style={styles.callType}>
          {callType === 'video' ? 'Video' : 'Audio'} Call
        </Text>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
          <Icon name="call-end" size={36} color="#fff" />
          <Text style={styles.buttonText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
          <Icon name="call" size={36} color="#fff" />
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'space-between',
    paddingVertical: 100,
  },
  callerInfo: {
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
  },
  callType: {
    fontSize: 18,
    color: '#aaa',
    marginTop: 10,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },
  rejectButton: {
    alignItems: 'center',
    backgroundColor: '#e74c3c',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
  },
  acceptButton: {
    alignItems: 'center',
    backgroundColor: '#27ae60',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
});

export default IncomingCallScreen;
```

---

## 🔔 Setup in App.js

### `App.js` or Main Navigator
```javascript
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { connectSocket, getSocket } from './services/socket';
import CallService from './services/CallService';

// Import screens
import HomeScreen from './screens/HomeScreen';
import CallScreen from './screens/CallScreen';
import IncomingCallScreen from './screens/IncomingCallScreen';

const Stack = createNativeStackNavigator();

function App() {
  useEffect(() => {
    initializeApp();
    return () => {
      const socket = getSocket();
      if (socket) socket.disconnect();
    };
  }, []);

  const initializeApp = async () => {
    // Connect socket
    await connectSocket();
    
    // Initialize call service listeners
    CallService.initializeSocketListeners();
    
    // Handle incoming calls globally
    const socket = getSocket();
    socket.on('incomingCall', ({ callId, callerId, callType, caller }) => {
      // Navigate to incoming call screen
      // You'll need to use a navigation ref for this
      navigationRef.current?.navigate('IncomingCall', {
        callId,
        callerId,
        callType,
        caller,
      });
    });
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen 
          name="CallScreen" 
          component={CallScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="IncomingCall" 
          component={IncomingCallScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Navigation ref for global navigation
export const navigationRef = React.createRef();

export default App;
```

---

## 🎯 Making a Call from Chat Screen

### `screens/ChatScreen.js` (example)
```javascript
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ChatScreen = ({ navigation, route }) => {
  const { userId, userName } = route.params;

  const handleAudioCall = () => {
    navigation.navigate('CallScreen', {
      receiverId: userId,
      receiverName: userName,
      callType: 'audio',
      isIncoming: false,
    });
  };

  const handleVideoCall = () => {
    navigation.navigate('CallScreen', {
      receiverId: userId,
      receiverName: userName,
      callType: 'video',
      isIncoming: false,
    });
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Chat messages here */}
      
      <View style={{ flexDirection: 'row', padding: 10 }}>
        <TouchableOpacity onPress={handleAudioCall} style={{ marginRight: 20 }}>
          <Icon name="call" size={28} color="#4a90e2" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleVideoCall}>
          <Icon name="videocam" size={28} color="#4a90e2" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatScreen;
```

---

## 📊 Call History API Usage

### Fetch Call History
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const fetchCallHistory = async (type = null, limit = 50) => {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    const queryParams = new URLSearchParams();
    
    if (type) queryParams.append('type', type); // 'audio' or 'video'
    queryParams.append('limit', limit);
    
    const response = await fetch(
      `http://192.168.29.81:5000/api/calls/history?${queryParams}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      return data.data; // Array of call records
    }
  } catch (error) {
    console.error('Error fetching call history:', error);
  }
  return [];
};

// Usage
const calls = await fetchCallHistory('video', 20);
```

### Fetch Missed Calls
```javascript
const fetchMissedCalls = async () => {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    
    const response = await fetch(
      'http://192.168.29.81:5000/api/calls/missed',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      return data.data; // Array of missed calls
    }
  } catch (error) {
    console.error('Error fetching missed calls:', error);
  }
  return [];
};
```

---

## 🎨 Call History Screen Component

### `screens/CallHistoryScreen.js`
```javascript
import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CallHistoryScreen = ({ navigation }) => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCallHistory();
  }, []);

  const loadCallHistory = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(
        'http://192.168.29.81:5000/api/calls/history?limit=50',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setCalls(data.data);
      }
    } catch (error) {
      console.error('Error loading call history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCallIcon = (call) => {
    const isMissed = call.isMissed;
    const isVideo = call.callType === 'video';
    const isOutgoing = call.direction === 'outgoing';

    if (isMissed) return { name: 'phone-missed', color: '#e74c3c' };
    if (isVideo) return { name: 'videocam', color: '#27ae60' };
    if (isOutgoing) return { name: 'call-made', color: '#27ae60' };
    return { name: 'call-received', color: '#4a90e2' };
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString();
  };

  const handleCallBack = (call) => {
    const otherUser = call.direction === 'outgoing' 
      ? call.receiverId 
      : call.callerId;
      
    navigation.navigate('CallScreen', {
      receiverId: otherUser._id,
      receiverName: otherUser.username,
      callType: call.callType,
      isIncoming: false,
    });
  };

  const renderCallItem = ({ item }) => {
    const icon = getCallIcon(item);
    const otherUser = item.direction === 'outgoing' 
      ? item.receiverId 
      : item.callerId;

    return (
      <TouchableOpacity 
        style={styles.callItem}
        onPress={() => handleCallBack(item)}>
        
        {/* User Avatar */}
        {otherUser.images?.[0] ? (
          <Image source={{ uri: otherUser.images[0] }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {otherUser.username?.charAt(0)?.toUpperCase()}
            </Text>
          </View>
        )}

        {/* Call Info */}
        <View style={styles.callInfo}>
          <Text style={styles.userName}>{otherUser.username}</Text>
          <View style={styles.callDetails}>
            <Icon name={icon.name} size={16} color={icon.color} />
            <Text style={[styles.callType, { color: icon.color }]}>
              {item.isMissed ? 'Missed' : item.direction}
            </Text>
            {item.duration > 0 && (
              <Text style={styles.duration}>
                • {formatDuration(item.duration)}
              </Text>
            )}
          </View>
        </View>

        {/* Time */}
        <Text style={styles.time}>{formatDate(item.createdAt)}</Text>

        {/* Call Button */}
        <TouchableOpacity onPress={() => handleCallBack(item)}>
          <Icon 
            name={item.callType === 'video' ? 'videocam' : 'call'} 
            size={24} 
            color="#4a90e2" 
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={calls}
        keyExtractor={(item) => item._id}
        renderItem={renderCallItem}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No call history</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  callInfo: {
    flex: 1,
    marginLeft: 15,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  callDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  callType: {
    fontSize: 14,
    marginLeft: 5,
    textTransform: 'capitalize',
  },
  duration: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  time: {
    fontSize: 12,
    color: '#999',
    marginRight: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default CallHistoryScreen;
```

---

## ⚡ Testing Checklist

- [ ] Install all dependencies
- [ ] Configure Android/iOS permissions
- [ ] Update backend URL in socket.js
- [ ] Test audio call (both initiate and receive)
- [ ] Test video call (both initiate and receive)
- [ ] Test mute/unmute microphone
- [ ] Test video on/off
- [ ] Test camera flip (front/back)
- [ ] Test call rejection
- [ ] Test call end from both sides
- [ ] Test call history fetch
- [ ] Test missed calls fetch
- [ ] Test when user is offline

---

## 🐛 Common Issues & Solutions

### 1. **Receiver Not Getting Incoming Call**

**Problem**: Caller initiates call but receiver doesn't see the incoming call screen.

**Debug Steps**:

1. **Check Server Logs** - Look for these logs:
```
[SOCKET] User connected: <userId>, socket: <socketId>
[CALL] initiateCall from <callerId> to <receiverId> (type: audio/video)
[CALL] Receiver found: <username> (<userId>)
[CALL] Online users Map keys: [...]
[CALL] Found X socket(s) for receiver
[CALL] Emitting incomingCall to socket: <socketId>
```

2. **Check Receiver App Logs** - Should see:
```
[SOCKET] Auth token present: true
✅ Socket connected: <socketId>
[CALL] Initializing socket listeners for calling
[CALL] 📞 Incoming call received!
```

3. **Common Causes**:
   - ❌ Receiver not connected to socket → Check `AsyncStorage` for `accessToken`
   - ❌ Wrong `receiverId` → Verify both devices use same user ID format
   - ❌ Socket auth failed → Check JWT token validity
   - ❌ Callback not set → Ensure `CallService.initializeSocketListeners()` runs before call

**Fix**:
```javascript
// In App.js, initialize socket and listeners early
useEffect(() => {
  const init = async () => {
    await connectSocket();
    CallService.initializeSocketListeners();
    console.log('[INIT] Socket and call listeners ready');
  };
  init();
}, []);
```

### 2. **Camera/Mic Permission Denied**
```javascript
import { PermissionsAndroid, Platform } from 'react-native';

const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    
    if (granted['android.permission.CAMERA'] !== 'granted' ||
        granted['android.permission.RECORD_AUDIO'] !== 'granted') {
      alert('Permissions required for calling');
      return false;
    }
  }
  return true;
};

// Call before starting a call
const hasPermissions = await requestPermissions();
if (hasPermissions) {
  CallService.startCall(receiverId, callType);
}
```

### 3. **Socket Disconnects**
- Ensure `reconnection: true` in socket config
- Handle `connect_error` and `disconnect` events
- Show connection status to user

### 4. **No Remote Stream**
- Check firewall/NAT settings
- Use TURN server for production (not just STUN)
- Verify both users have proper permissions

### 5. **Audio Routing Issues (Android)**
```javascript
import InCallManager from 'react-native-incall-manager';

// Start call with proper audio routing
InCallManager.start({ media: 'audio', auto: true, ringback: '_DTMF_' });

// Stop when call ends
InCallManager.stop();
```

---

## 🚀 Production Recommendations

1. **Add TURN Server** (for NAT traversal):
```javascript
getIceServers() {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:your-turn-server.com:3478',
        username: 'username',
        credential: 'password',
      },
    ],
  };
}
```

2. **Handle Background State** - Use `react-native-callkeep` for native call UI

3. **Add Push Notifications** - For incoming calls when app is closed

4. **Network Quality Indicator** - Show connection quality to users

5. **Call Recording** (if needed) - Implement server-side recording

Your React Native calling system is now ready! 🎉📞

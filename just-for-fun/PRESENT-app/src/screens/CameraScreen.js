import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { recordCheckIn } from '../utils/storage';

/**
 * Camera check-in screen.
 * Takes a photo, saves it to the device library, and records the streak.
 */
export default function CameraScreen({ navigation }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [libraryPermission, requestLibraryPermission] = MediaLibrary.usePermissions({
    writeOnly: true,
  });

  const cameraRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Ask for permissions once on mount.
  const hasAskedRef = useRef(false);
  useEffect(() => {
    if (hasAskedRef.current) return;
    hasAskedRef.current = true;
    requestCameraPermission();
    requestLibraryPermission();
  }, [requestCameraPermission, requestLibraryPermission]);

  async function handleCapture() {
    if (isCapturing || !cameraRef.current) return;
    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync();
      await MediaLibrary.Asset.create(photo.uri);
      await recordCheckIn();
    } catch (error) {
      console.warn('Could not complete the check-in:', error);
    }

    navigation.navigate('Home');
  }

  // Waiting on permission check.
  if (!cameraPermission || !libraryPermission) {
    return (
      <View style={styles.messageScreen}>
        <ActivityIndicator color="#ffffff" />
        <Text style={styles.messageText}>Getting the camera ready…</Text>
      </View>
    );
  }

  // Permission denied.
  if (!cameraPermission.granted || !libraryPermission.granted) {
    return (
      <View style={styles.messageScreen}>
        <Text style={styles.messageTitle}>Camera access needed</Text>
        <Text style={styles.messageText}>
          PRESENT needs the camera and photo library to save your check-in. You can turn them on in
          your phone's Settings.
        </Text>
        <Pressable
          style={styles.textButton}
          onPress={() => navigation.navigate('Home')}
          accessibilityRole="button"
          accessibilityLabel="Go back to the home screen"
        >
          <Text style={styles.textButtonLabel}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setIsCameraReady(true)}
      />
      <View style={styles.controls}>
        <Text style={styles.hint}>
          {isCapturing ? 'Saving your check-in…' : 'Take a photo to check in'}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.shutter,
            pressed && styles.shutterPressed,
            (!isCameraReady || isCapturing) && styles.shutterDisabled,
          ]}
          onPress={handleCapture}
          disabled={!isCameraReady || isCapturing}
          accessibilityRole="button"
          accessibilityLabel="Take a check-in photo"
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hint: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowRadius: 6,
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
  shutterPressed: {
    opacity: 0.7,
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  messageScreen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  messageTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  messageText: {
    color: '#d8d5cf',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'center',
  },
  textButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  textButtonLabel: {
    color: '#e07a5f',
    fontSize: 16,
    fontWeight: '700',
  },
});

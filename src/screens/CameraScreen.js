// CameraScreen.js
// -----------------------------------------------------------------------------
// The check-in screen. This is where the streak actually happens:
//
//   1. Ask for the two permissions we need — camera (to take the photo) and
//      photo library (to save it).
//   2. Show a full-screen camera preview with one big shutter button.
//   3. On tap: take the photo, save it to the phone's photo library, record the
//      check-in, then go back Home so the user sees their new streak.
//
// Nothing leaves the device. The photo goes straight to the local library, and
// the streak rules all live in src/utils/storage.js — this screen just calls
// recordCheckIn() and lets that file decide what the new count should be.
// -----------------------------------------------------------------------------

import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { recordCheckIn } from '../utils/storage';

/**
 * The camera check-in screen.
 *
 * @param {object} props
 * @param {object} props.navigation - given to us by React Navigation. We use it
 *   to send the user back to Home once the photo is saved.
 */
export default function CameraScreen({ navigation }) {
  // --- Permissions ----------------------------------------------------------
  // Both hooks hand back the same shape: [status, request]. `status` is null
  // until the first check finishes, then it's an object with `granted` and
  // `canAskAgain` on it. We ask for write-only library access because we never
  // read the user's photos — we only add ours.

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [libraryPermission, requestLibraryPermission] = MediaLibrary.usePermissions({
    writeOnly: true,
  });

  // --- Camera handle --------------------------------------------------------
  // A ref is how you reach into a component to call a method on it. CameraView
  // exposes takePictureAsync(), and this ref is our way to call it from the
  // button handler below.

  const cameraRef = useRef(null);

  // The camera needs a moment to warm up. takePictureAsync() before it's ready
  // can fail, so the shutter stays disabled until onCameraReady fires.
  const [isCameraReady, setIsCameraReady] = useState(false);

  // True while a capture is in flight. Taking a photo, saving it, and writing
  // the streak all take a beat, so this guards against a double tap firing the
  // whole flow twice (which would save two photos).
  const [isCapturing, setIsCapturing] = useState(false);

  // --- Asking on mount ------------------------------------------------------
  // The hooks above only *check* on their own; they never prompt. This effect
  // does the asking, once, as soon as the screen appears — the user tapped a
  // nudge expecting a camera, so the reason for the prompts is obvious.
  //
  // The ref is a one-time latch. Requesting updates the permission state, which
  // re-renders this component, and without the latch we could end up asking
  // again and again. A ref (unlike state) survives re-renders without causing
  // one, which makes it the right tool for "have I done this yet?".

  const hasAskedRef = useRef(false);

  useEffect(() => {
    if (hasAskedRef.current) {
      return;
    }

    hasAskedRef.current = true;

    // Requesting is safe even when permission was already granted — the OS
    // just answers "yes" without showing a dialog.
    requestCameraPermission();
    requestLibraryPermission();
  }, [requestCameraPermission, requestLibraryPermission]);

  // --- Capture flow ---------------------------------------------------------
  // The one action of this screen, in the order the design lays it out.

  async function handleCapture() {
    // Ignore taps while a capture is already running.
    if (isCapturing || !cameraRef.current) {
      return;
    }

    setIsCapturing(true);

    try {
      // 1. Take the photo. It lands in the app's temporary cache folder, so it
      //    is not in the user's library yet — that's the next step.
      const photo = await cameraRef.current.takePictureAsync();

      // 2. Save it to the device photo library. Asset.create() copies the file
      //    out of the cache and into the real library, which is what makes the
      //    photo show up in the Photos app. Local only — nothing is uploaded.
      await MediaLibrary.Asset.create(photo.uri);

      // 3. Record the check-in. Every streak rule (including "same day doesn't
      //    count twice") lives inside recordCheckIn(), so there is nothing to
      //    work out here.
      await recordCheckIn();
    } catch (error) {
      // Minimal error handling per the spec: log it and still head back Home
      // rather than leaving the user stuck on a camera that seems broken.
      console.warn('Could not complete the check-in:', error);
    }

    // 4. Back to Home, where the streak count is on show. navigate() pops back
    //    to the existing Home screen when there is one, and still works if the
    //    app was launched cold straight into the camera from a notification.
    navigation.navigate('Home');
  }

  // --- Permission states ----------------------------------------------------
  // Two short holding screens before the camera itself: one while the system is
  // deciding, and one if the user said no. Both are plain text — the spec asks
  // for just enough to not leave the user confused.

  // Still waiting on the first permission check.
  if (!cameraPermission || !libraryPermission) {
    return (
      <View style={styles.messageScreen}>
        <ActivityIndicator color="#ffffff" />
        <Text style={styles.messageText}>Getting the camera ready…</Text>
      </View>
    );
  }

  // Permission was refused. Only Settings can undo that, so say so and give the
  // user a way out of the screen.
  if (!cameraPermission.granted || !libraryPermission.granted) {
    return (
      <View style={styles.messageScreen}>
        <Text style={styles.messageTitle}>Camera access needed</Text>
        <Text style={styles.messageText}>
          PRESENT needs the camera and photo library to save your check-in. You
          can turn them on in your phone's Settings.
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

  // --- Camera preview -------------------------------------------------------
  // Both permissions granted, so show the real thing: a full-screen preview
  // with the shutter button floating over the bottom of it.

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setIsCameraReady(true)}
      />

      {/* Controls sit in their own absolutely-positioned layer so they float on
          top of the preview instead of shrinking it. */}
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
          {/* The inner circle is the classic camera-shutter look: a white ring
              with a filled dot inside it. */}
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

// --- Styles ------------------------------------------------------------------
// Kept at the bottom so the component above reads as behaviour, not pixels. The
// background is black here (rather than the warm home-screen cream) because a
// dark frame around a camera preview is what people expect.

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  // flex: 1 makes the preview fill everything the parent gives it, which is the
  // whole screen.
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
    // A soft shadow keeps the text readable over a bright photo.
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
  textButtonLabel: {
    color: '#e07a5f',
    fontSize: 16,
    fontWeight: '700',
  },
  textButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
});

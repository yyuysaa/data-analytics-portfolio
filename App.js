// App.js
// -----------------------------------------------------------------------------
// The entry point. This file is deliberately thin — the screens hold the UI and
// src/utils holds the data logic. All App.js does is the three wiring jobs that
// have to happen once, at the very top of the app:
//
//   1. Navigation: a two-screen stack, Home → Camera.
//   2. Foreground notifications: tell expo-notifications to actually show a
//      nudge even when the app is already open.
//   3. The notification tap handler: when the user taps a nudge, take them
//      straight to the camera so they can check in.
//
// The loop the whole app is built around: nudge fires → user taps → Camera →
// photo saved and check-in recorded → back to Home with a fresh streak.
// -----------------------------------------------------------------------------

import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CameraScreen from './src/screens/CameraScreen';
import HomeScreen from './src/screens/HomeScreen';

// --- Foreground notification handler ----------------------------------------
// By default a notification that arrives while the app is open is delivered
// silently — the user sees nothing. That would break the loop, because the nudge
// is the thing that prompts the check-in. This handler says "show it anyway".
//
// It is set at module level (outside the component) on purpose: it needs to be
// in place before any notification can arrive, and setting it here means it
// happens once when the file is first loaded rather than on every render.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowBanner = the pop-up at the top of the screen.
    // shouldShowList = the entry kept in Notification Centre / the shade.
    // (These two replaced the older single `shouldShowAlert` flag.)
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    // No unread badge on the app icon — the streak is the only counter that
    // matters here.
    shouldSetBadge: false,
  }),
});

// --- The navigator -----------------------------------------------------------
// createNativeStackNavigator() hands back an object with Navigator and Screen
// components on it. Created once at module level so it isn't rebuilt on render.
const Stack = createNativeStackNavigator();

// --- Navigation ref ----------------------------------------------------------
// The notification tap handler lives outside the navigator, so it has no
// `navigation` prop to work with. This ref is the supported way to navigate from
// that kind of outside-the-tree code: hand it to NavigationContainer and it
// gains the same navigate() method a screen would have.
const navigationRef = createNavigationContainerRef();

/**
 * The root component.
 */
export default function App() {
  // --- Cold-start safety net ------------------------------------------------
  // Two ways a tap reaches us, and they need different handling:
  //
  //   Warm start — the app was already running. The navigator is mounted, so we
  //   can navigate immediately.
  //
  //   Cold start — tapping the nudge is what launched the app. The listener can
  //   fire before the navigator has finished mounting, and navigating then is
  //   simply ignored (or throws). So instead we remember the route here and
  //   replay it from onReady below, once the navigator is live.
  //
  // A ref rather than state because writing to it must not trigger a re-render —
  // it's a message being passed between two callbacks, not something we draw.
  const pendingRouteRef = useRef(null);

  /**
   * Send the user to a screen, whether or not the navigator is ready yet.
   *
   * @param {string} routeName - 'Home' or 'Camera'.
   */
  function navigateWhenPossible(routeName) {
    if (navigationRef.isReady()) {
      navigationRef.navigate(routeName);
    } else {
      // Not mounted yet — park it and let handleNavigatorReady pick it up.
      pendingRouteRef.current = routeName;
    }
  }

  /**
   * Called by NavigationContainer the moment the navigator can accept commands.
   * If a notification tap arrived during startup, this is where it finally runs.
   */
  function handleNavigatorReady() {
    if (pendingRouteRef.current) {
      navigationRef.navigate(pendingRouteRef.current);

      // Clear it so a later remount doesn't reopen the camera out of nowhere.
      pendingRouteRef.current = null;
    }
  }

  // --- Notification tap listener --------------------------------------------
  // FR-3.1: tapping the nudge opens the camera.
  //
  // "Response" is expo-notifications' word for a user interaction with a
  // notification — for us that means the tap. addNotificationResponseReceived-
  // Listener returns a subscription object, and the function we return from the
  // effect calls subscription.remove(). That cleanup matters: without it, a
  // hot reload (or any remount) would leave the old listener attached and every
  // tap would be handled twice.
  //
  // The empty dependency array means "set this up once, tear it down when the
  // app unmounts" — not on every render.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      // Only one kind of notification exists in this app, so every tap means
      // the same thing: go check in.
      navigateWhenPossible('Camera');
    });

    return () => subscription.remove();
  }, []);

  // --- Screen tree ----------------------------------------------------------
  // SafeAreaProvider is required by React Navigation — it measures the notch and
  // home-indicator insets so content isn't hidden behind them.
  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} onReady={handleNavigatorReady}>
        {/* headerShown: false for both screens — Home draws its own "PRESENT"
            title, and Camera wants the whole screen for the preview. */}
        <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
          {/* These route names are the contract with the screens: CameraScreen
              calls navigation.navigate('Home'), and the tap handler above sends
              the user to 'Camera'. Renaming one means renaming both. */}
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Camera" component={CameraScreen} />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Dark status bar text to suit the light, warm home screen. */}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

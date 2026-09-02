import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CameraScreen from './src/screens/CameraScreen';
import HomeScreen from './src/screens/HomeScreen';

// Show notifications even when the app is already open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();

// Lets outside-the-navigator code (the notification tap handler) call navigate().
const navigationRef = createNavigationContainerRef();

export default function App() {
  // Stores a pending route if a notification tap arrives before the navigator mounts.
  const pendingRouteRef = useRef(null);

  function navigateWhenPossible(routeName) {
    if (navigationRef.isReady()) {
      navigationRef.navigate(routeName);
    } else {
      pendingRouteRef.current = routeName;
    }
  }

  function handleNavigatorReady() {
    if (pendingRouteRef.current) {
      navigationRef.navigate(pendingRouteRef.current);
      pendingRouteRef.current = null;
    }
  }

  // When the user taps a nudge notification, open the camera to check in.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      navigateWhenPossible('Camera');
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} onReady={handleNavigatorReady}>
        <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Camera" component={CameraScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

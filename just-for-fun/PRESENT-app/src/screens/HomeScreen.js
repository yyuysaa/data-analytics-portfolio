import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { generateNudge } from '../utils/generateNudge';
import { getStreakData, loadActivity, saveActivity } from '../utils/storage';

// Convert a Date to "HH:mm" for storage.
function toTimeString(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Convert an "HH:mm" string back to a Date for the picker.
function toDate(timeString) {
  const date = new Date();
  const [hours, minutes] = timeString.split(':');
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date;
}

export default function HomeScreen() {
  const [name, setName] = useState('');
  const [time, setTime] = useState(new Date());
  const [savedActivity, setSavedActivity] = useState(null);
  const [streak, setStreak] = useState({ count: 0, lastCheckInDate: null });
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [isLoading, setIsLoading] = useState(true);

  const loadSavedData = useCallback(async () => {
    const [activity, streakData] = await Promise.all([loadActivity(), getStreakData()]);
    setSavedActivity(activity);
    setStreak(streakData);
    if (activity) {
      setName(activity.name);
      setTime(toDate(activity.time));
    }
    setIsLoading(false);
  }, []);

  // Reload whenever the screen comes back into focus (e.g. after a check-in).
  useFocusEffect(
    useCallback(() => {
      loadSavedData();
    }, [loadSavedData]),
  );

  function handleTimeChange(event, selectedDate) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate) setTime(selectedDate);
  }

  async function ensureNotificationPermission() {
    const existing = await Notifications.getPermissionsAsync();
    const isAllowed = (s) =>
      s.granted || s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (isAllowed(existing)) return true;
    if (!existing.canAskAgain) return false;

    const requested = await Notifications.requestPermissionsAsync();
    return isAllowed(requested);
  }

  async function handleSaveAndSchedule() {
    const allowed = await ensureNotificationPermission();
    if (!allowed) {
      Alert.alert(
        'Notifications are off',
        "PRESENT needs notification permission to nudge you at your activity time. You can turn it on in your phone's Settings.",
      );
      return;
    }

    const activityName = name.trim();
    await saveActivity({ name: activityName, time: toTimeString(time) });
    await Notifications.cancelAllScheduledNotificationsAsync();

    await Notifications.scheduleNotificationAsync({
      content: { title: 'PRESENT', body: generateNudge(activityName) },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.getHours(),
        minute: time.getMinutes(),
      },
    });

    await loadSavedData();
  }

  const canSave = name.trim().length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>PRESENT</Text>
      <Text style={styles.subtitle}>Show up for one thing today.</Text>

      {/* Streak card */}
      <View style={styles.card}>
        <Text style={styles.streakNumber}>{streak.count}</Text>
        <Text style={styles.streakLabel}>day streak</Text>
        <Text style={styles.streakHint}>
          {streak.lastCheckInDate
            ? 'One photo check-in keeps your streak going.'
            : 'Check in with a photo to start your streak.'}
        </Text>
      </View>

      {/* Currently scheduled activity */}
      <View style={styles.card}>
        <Text style={styles.cardHeading}>Today's activity</Text>
        {isLoading ? (
          <Text style={styles.emptyState}>Loading…</Text>
        ) : savedActivity ? (
          <>
            <Text style={styles.activityName}>{savedActivity.name}</Text>
            <Text style={styles.activityTime}>at {savedActivity.time}</Text>
          </>
        ) : (
          <Text style={styles.emptyState}>
            Nothing scheduled yet. Add one thing below and PRESENT will nudge you when it's time. 🌱
          </Text>
        )}
      </View>

      {/* Activity name input */}
      <View style={styles.field}>
        <Text style={styles.label}>What are you showing up for?</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Data Science class"
          placeholderTextColor="#9aa0a6"
          returnKeyType="done"
        />
      </View>

      {/* Time picker */}
      <View style={styles.field}>
        <Text style={styles.label}>When?</Text>
        {Platform.OS === 'android' && (
          <Pressable
            style={styles.timeRow}
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Change time, currently ${toTimeString(time)}`}
          >
            <Text style={styles.timeRowText}>{toTimeString(time)}</Text>
            <Text style={styles.timeRowAction}>Change</Text>
          </Pressable>
        )}
        {showPicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        )}
      </View>

      {/* Save button */}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          !canSave && styles.buttonDisabled,
          pressed && canSave && styles.buttonPressed,
        ]}
        onPress={handleSaveAndSchedule}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel="Save and schedule this activity"
      >
        <Text style={styles.buttonText}>Save &amp; Schedule</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fdfcf9',
  },
  content: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#1f2933',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eceae4',
  },
  cardHeading: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#9aa0a6',
    marginBottom: 8,
  },
  streakNumber: {
    fontSize: 72,
    fontWeight: '800',
    color: '#e07a5f',
    textAlign: 'center',
    lineHeight: 80,
  },
  streakLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2933',
    textAlign: 'center',
  },
  streakHint: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  activityName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1f2933',
  },
  activityTime: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyState: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6b7280',
  },
  field: {
    marginTop: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2933',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0ddd5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2933',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0ddd5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  timeRowText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2933',
  },
  timeRowAction: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e07a5f',
  },
  button: {
    backgroundColor: '#e07a5f',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    backgroundColor: '#e6ded9',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});

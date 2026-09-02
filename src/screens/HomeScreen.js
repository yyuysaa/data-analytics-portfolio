// HomeScreen.js
// -----------------------------------------------------------------------------
// The app's main screen. It does two jobs:
//
//   1. Shows the user where they stand — their current streak and the activity
//      they already scheduled (or a friendly nudge to create one).
//   2. Lets them set (or replace) that activity: type a name, pick a time,
//      tap "Save & Schedule".
//
// Data comes from src/utils/storage.js, which is the only file that talks to
// AsyncStorage. This screen just asks for the data and draws it.
// -----------------------------------------------------------------------------

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

// --- Time helpers ------------------------------------------------------------
// The picker hands us a full JavaScript Date, but we only care about the hour
// and minute, and storage keeps time as a simple "HH:mm" string. These two tiny
// functions translate between the two shapes.

/**
 * Turn a Date into the "HH:mm" string that storage expects.
 * padStart keeps single digits two characters long, so 9:05 becomes "09:05".
 *
 * @param {Date} date
 * @returns {string} e.g. "13:00"
 */
function toTimeString(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Turn an "HH:mm" string back into a Date so the picker can display it.
 * The date part is today — only the clock time matters here.
 *
 * @param {string} timeString e.g. "13:00"
 * @returns {Date}
 */
function toDate(timeString) {
  const date = new Date();

  // "13:00".split(':') gives ["13", "00"]; Number() turns those into 13 and 0.
  const [hours, minutes] = timeString.split(':');
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date;
}

/**
 * The home screen.
 *
 * @param {object} props
 * @param {object} [props.navigation] - passed in by React Navigation once the
 *   navigator is wired up. Not used yet; it arrives here so a later step can
 *   push the camera screen without changing this component's signature.
 */
export default function HomeScreen({ navigation }) {
  // --- State ----------------------------------------------------------------
  // `name` and `time` are the form fields the user edits.
  // `savedActivity` and `streak` are what we read back from storage — they are
  // kept separate from the form so editing the text box doesn't change the
  // "currently scheduled" summary until the user actually saves.

  const [name, setName] = useState('');
  const [time, setTime] = useState(new Date());
  const [savedActivity, setSavedActivity] = useState(null);
  const [streak, setStreak] = useState({ count: 0, lastCheckInDate: null });

  // Android shows the time picker as a pop-up dialog, so it only gets rendered
  // after the user taps the time row. iOS shows it inline all the time.
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  // While the first read from storage is in flight we show a quiet placeholder
  // instead of briefly flashing the "nothing scheduled" empty state.
  const [isLoading, setIsLoading] = useState(true);

  // --- Loading saved data ---------------------------------------------------
  // Reading from AsyncStorage is async, so this cannot happen while rendering.
  // It lives in its own function (wrapped in useCallback so its identity is
  // stable) because it is called again whenever the screen regains focus, to
  // pick up a streak that changed during a camera check-in.

  const loadSavedData = useCallback(async () => {
    const [activity, streakData] = await Promise.all([
      loadActivity(),
      getStreakData(),
    ]);

    setSavedActivity(activity);
    setStreak(streakData);

    // Pre-fill the form with whatever is already scheduled so the user can
    // tweak one field instead of retyping everything.
    if (activity) {
      setName(activity.name);
      setTime(toDate(activity.time));
    }

    setIsLoading(false);
  }, []);

  // useFocusEffect (rather than useEffect) runs this on first appearance *and*
  // every time the screen comes back into focus. That second part is what makes
  // the streak look right after a check-in: the camera screen updates storage,
  // navigates back here, and this re-read picks up the new count.
  //
  // The wrapper matters — useFocusEffect expects either nothing or a cleanup
  // function back, and loadSavedData is async so it returns a Promise. Calling
  // it inside a plain arrow function returns undefined and keeps it happy.
  useFocusEffect(
    useCallback(() => {
      loadSavedData();
    }, [loadSavedData]),
  );

  // --- Picker change handler ------------------------------------------------
  // The picker calls this with an event and the chosen Date. On Android the
  // dialog closes itself, and `selectedDate` is undefined if the user cancelled.

  function handleTimeChange(event, selectedDate) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (selectedDate) {
      setTime(selectedDate);
    }
  }

  // --- Notification permission ----------------------------------------------
  // iOS (and Android 13+) will not deliver notifications until the user says
  // yes. We ask on the first save rather than at app launch, so the prompt
  // arrives at a moment where the reason for it is obvious.

  /**
   * Make sure we are allowed to post notifications.
   *
   * getPermissionsAsync only checks — it never shows a dialog — so we call it
   * first and only prompt when we don't already have an answer. Asking again
   * after a "no" does nothing on iOS, which is why the alert points the user at
   * their Settings instead.
   *
   * @returns {Promise<boolean>} true when scheduling is allowed.
   */
  async function ensureNotificationPermission() {
    const existing = await Notifications.getPermissionsAsync();

    // On iOS a "provisional" grant means quiet notifications are allowed, which
    // is good enough for a nudge, so it counts as granted too.
    const isAllowed = (settings) =>
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (isAllowed(existing)) {
      return true;
    }

    // canAskAgain is false once the user has firmly declined.
    if (!existing.canAskAgain) {
      return false;
    }

    const requested = await Notifications.requestPermissionsAsync();
    return isAllowed(requested);
  }

  // --- Save & Schedule ------------------------------------------------------
  // The main action of the screen: persist the activity and set up the daily
  // nudge that will bring the user back to check in.

  async function handleSaveAndSchedule() {
    // 1. No permission means no nudge, so stop early and say so plainly.
    const allowed = await ensureNotificationPermission();

    if (!allowed) {
      Alert.alert(
        'Notifications are off',
        "PRESENT needs notification permission to nudge you at your activity time. You can turn it on in your phone's Settings.",
      );
      return;
    }

    // 2. Save the activity. trim() drops accidental spaces, and toTimeString
    //    converts the picker's Date into the "HH:mm" shape storage expects.
    const activityName = name.trim();
    await saveActivity({ name: activityName, time: toTimeString(time) });

    // 3. Clear anything scheduled before. The app supports one activity at a
    //    time, so cancelling everything guarantees the user never gets nudged
    //    about an activity they already replaced.
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 4. Ask the nudge generator for the encouraging line. It's synchronous
    //    today and picks from a hardcoded list, but this is the seam where a
    //    real AI call will slot in later.
    const nudge = generateNudge(activityName);

    // 5. Schedule the notification. The DAILY trigger fires every day once the
    //    clock hits this hour and minute, so the user sets it up once.
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'PRESENT',
        body: nudge,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.getHours(),
        minute: time.getMinutes(),
      },
    });

    // 6. Re-read storage so the "Today's activity" card above shows what we
    //    just saved instead of the previous activity.
    await loadSavedData();
  }

  // Trimming here means a name of only spaces counts as empty, so the button
  // stays disabled until there is something real to schedule.
  const canSave = name.trim().length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* --- Header ------------------------------------------------------ */}
      {/* App name and a one-line reminder of what this screen is for. */}
      <Text style={styles.title}>PRESENT</Text>
      <Text style={styles.subtitle}>Show up for one thing today.</Text>

      {/* --- Streak ------------------------------------------------------ */}
      {/* The reward loop: one check-in keeps the day alive, and the count is
          shown as a big number so progress is the first thing you notice. */}
      <View style={styles.card}>
        <Text style={styles.streakNumber}>{streak.count}</Text>
        <Text style={styles.streakLabel}>day streak</Text>
        <Text style={styles.streakHint}>
          {streak.lastCheckInDate
            ? 'One photo check-in keeps your streak going.'
            : 'Check in with a photo to start your streak.'}
        </Text>
      </View>

      {/* --- Currently scheduled ---------------------------------------- */}
      {/* Either the saved activity (name + time) or a friendly empty state
          telling a brand new user what to do next. */}
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
            Nothing scheduled yet. Add one thing below and PRESENT will nudge
            you when it's time. 🌱
          </Text>
        )}
      </View>

      {/* --- Activity name input ---------------------------------------- */}
      {/* Free text, so anything from "Data Science class" to "call Mum" works. */}
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

      {/* --- Time picker ------------------------------------------------- */}
      {/* mode="time" gives just hour and minute — today's date is assumed. On
          Android the picker is a dialog, so we show the chosen time as a
          tappable row that opens it. */}
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

      {/* --- Save & Schedule button -------------------------------------- */}
      {/* Saves the activity and sets up the daily nudge notification. */}
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

// --- Styles ------------------------------------------------------------------
// StyleSheet.create keeps all the visual values in one block at the bottom, so
// the component above stays about behaviour rather than pixels.

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
    // Big numerals need a little breathing room or the line clips on Android.
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

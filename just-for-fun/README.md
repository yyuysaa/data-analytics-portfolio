# 🎲 Just for Fun Projects

This folder contains some of my side projects and coding experiments that I build outside of formal coursework. They showcase my curiosity and creativity when exploring programming ideas.

---

## 🧩 GUI Scrabble Game (C++ / Qt)

One of my recent school projects was creating a **Graphical User Interface (GUI) Scrabble game**.  

### 🔹 Project Overview
- Developed in **C++** using the **Qt framework** for GUI design.  
- Implemented a digital version of Scrabble with:
  - Interactive game board.
  - Tile dragging and placement.
  - Automatic score calculation for valid words.
  - Turn-based play for multiple players.

### 🔹 What I Learned
- Building GUIs in C++ with Qt (layouts, signals/slots, event handling).
- Designing and managing game state with object-oriented programming.
- Handling word validation and scoring logic.
- Connecting backend logic with a user-friendly front end.

### 🔹 Future Improvements
- Add a single-player mode with AI opponent logic.
- Enhance board visuals (bonus tiles, animations).
- Integrate larger dictionaries for more realistic word play.
- Add save/load functionality for ongoing games.

---

✨ This project combined my love for games with hands-on experience in GUI programming. It taught me how to bring a classic board game to life through C++ and Qt!

---
## 📱 PRESENT — Daily Habit Check-In App (React Native / Expo)

One of my recent side projects was building **PRESENT**, a minimalist mobile app that helps you show up for one meaningful activity every day.

### 🔹 Project Overview

- Developed in **React Native** using the **Expo** framework for cross-platform iOS and Android support.
- Built a habit-tracking app with:
  - A **daily streak system** (Duolingo-style) that tracks consecutive check-in days.
  - A **photo check-in flow** — you prove you showed up by taking a photo with the in-app camera.
  - **Daily push notifications** that nudge you at the exact time you scheduled your activity.
  - A home screen showing your current streak and today's scheduled activity.
  - Persistent local storage using **AsyncStorage** — all data stays on the device, nothing uploaded.

### 🔹 What I Learned

- Building multi-screen React Native apps with **React Navigation** (stack navigator, screen focus hooks).
- Handling device permissions at runtime — camera, photo library, and notification access.
- Scheduling and managing **local push notifications** with Expo Notifications (daily recurring triggers, notification tap deep-linking).
- Managing async data flow with `AsyncStorage` — saving, loading, and keeping UI in sync with persisted data.
- Designing streak logic: same-day deduplication, day-gap detection, and streak reset rules.
- Separating concerns cleanly — storage utilities, nudge generation, and UI all live in their own layers.

### 🔹 Future Improvements

- Replace hardcoded nudge templates with AI-generated messages (the seam is already designed in the codebase).
- Add a history view so users can look back at their check-in photo log.
- Support multiple activities instead of just one at a time.
- Add a gentle streak-freeze feature for planned rest days.

---

✨ PRESENT started from a simple idea: most habit apps are too complex. This one does exactly one thing — show up, take a photo, keep your streak alive. Building it taught me how to wire together permissions, notifications, navigation, and persistent storage in a real mobile app from scratch.




# VeloPulse 🚴‍♂️⚡ | Smart Cycling Studio & Athletic Analytics

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.5-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Electron](https://img.shields.io/badge/Electron-44.7-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Garmin FIT SDK](https://img.shields.io/badge/Garmin_FIT_SDK-21.2-00508F)](https://developer.garmin.com/fit/overview/)

**VeloPulse** is a modern, unified indoor cycling studio and athletic performance analytics platform. It combines real-time smart trainer control with direct **Intervals.icu** training analysis, biometrics tracking, and workout execution across all platforms.

Styled in a refined **Google Material 3 Dark theme** (charcoal scaffold `#131316`, surface containers, pill navigation, and Material You accents).

---

## 📱 Cross-Platform Availability

VeloPulse runs natively or as an app on all major operating systems:

| Platform | Format | Description |
| :--- | :--- | :--- |
| 📱 **Android** | `.apk` | Native Capacitor BLE with background wake-lock and direct `.fit` export |
| 🍏 **iOS** | Xcode Project | Native Capacitor iOS app with Bluetooth Central background capabilities |
| 🪟 **Windows 11** | `.zip` (Portable) | Standalone desktop application with `VeloPulse.exe` |
| 🍏 **macOS** | `.zip` (`.app`) | macOS standalone desktop application bundle |
| 🐧 **Linux** | `.AppImage` / `.tar.gz` | Universal Linux binaries + `VeloPulse-Linux.sh` launcher |
| 🌐 **Web** | Web App | Modern PWA/SPA optimized for Chrome, Edge, and Chromium |

All pre-compiled packages are available in the [GitHub Releases](https://github.com/frr0/Cycling-App/releases) section.

---

## 🌟 Key Features

### 🚴 1. Indoor Smart Trainer & Ride Studio
* **Bluetooth Sensor Connectivity**:
  * **Smart Trainer (FTMS & Cycling Power)**: Connects via Bluetooth FTMS (`0x1826`) or Cycling Power (`0x1818`). Live instantaneous power (W), 3-second smoothing, cadence (RPM), and hardware flywheel speed.
  * **Bluetooth Cadence Sensor**: Dedicated crank cadence sensor support (`0x1816`).
  * **Bluetooth Heart Rate Monitor**: Live BPM, HR zones, and HR intensity tracking (`0x180D`).
  * **Virtual Cyclist Simulator Mode**: Built-in simulator to test and execute workouts without requiring physical bike hardware.
* **Advanced Cycling Physics Engine**:
  * Calculates real-world road velocity and distance using aerodynamic drag ($C_d A$), rolling resistance ($C_{rr}$), rider weight, bike weight, and road gradient:
    $$F_{drive} = \frac{P_{watts} \cdot \eta}{v}, \quad F_{resist} = 0.5 \cdot \rho \cdot C_d A \cdot v^2 + C_{rr} \cdot m \cdot g + m \cdot g \cdot \sin(\theta)$$
  * Toggle between **Virtual Physics Speed** and **Flywheel Speed**.
* **Zwift (.zwo) Workout Runner & Auto ERG Control**:
  * Execute custom Zwift `.zwo` XML workouts or built-in presets (Sweet Spot Progression, VO2 Max Boost, Over-Under Threshold, FTP Ramp Test, Active Recovery).
  * Automatically transmits target wattage to smart trainers via Bluetooth FTMS Control Point (`0x2AD9`).
  * Live ERG Bias adjustment (-20% to +20%) and interval skip forward/backward.
  * Multi-tone audio countdown beeps on interval transitions.
* **Garmin .FIT Activity File Generator**:
  * Generates 100% compliant `.fit` binary activity files using `@garmin/fitsdk`.
  * Second-by-second records with power, cadence, heart rate, speed, distance, normalized power, TSS, and IF.
  * Supports saving in-progress / partial session data even if stopped early.
  * Ready for 1-click upload to **Strava**, **Garmin Connect**, and **Intervals.icu**.

---

### 🗺️ 2. Dedicated Activity Page & Interactive GPS Route Map
* **Dedicated Full-Page View**:
  * Opening any activity from the Dashboard or Activities list navigates to a dedicated page (`ActivityDetailView`) instead of a modal popup.
  * Integrated breadcrumb navigation with a quick `← Back to Activities / Dashboard` button and `Escape` keyboard shortcut.
* **Interactive Leaflet Route Map**:
  * Decodes Google/Strava summary polylines and Intervals.icu stream coordinates.
  * **CartoDB Dark Matter** dark tiles matching the Material 3 Dark UI, with 1-click toggle to standard OpenStreetMap tiles.
  * Custom **START** (green pill) and **FINISH** (coral checkered flag) markers.
  * Recenter, zoom, and fullscreen controls.
  * Distance & elevation badge overlays.
  * Smart detection for **Indoor Sessions** (displays trainer workout info when no GPS track is present).
* **Comprehensive Metrics**:
  * Distance, moving time, elapsed time, elevation gain, average/max watts, Normalized Power (NP), Intensity Factor (IF), work (kJ), speed, cadence, and heart rate.
  * **Heart Rate Zones Distribution**: stacked bar and detailed time-in-zone breakdown.
  * **Power Zones Distribution**: 7-zone Coggan power model.
  * **Interval Repeats**: structured table showing work and recovery intervals with average wattage and heart rate.
  * **Athlete Notes & Exertion**: RPE (1-10) and feeling indicators.

---

### 📈 3. Athletic Performance & Recovery Analytics (Intervals.icu)
* **Direct Intervals.icu Sync or 1-Click Demo Mode**:
  * Authenticate using your Intervals.icu API Key, or explore immediately using the simulated pro athlete dataset.
* **Customizable Heart Rate Zones**:
  * Configure custom HR zones (min/max BPM, names, colors) in Settings.
  * Automatically imports and syncs athlete sport settings from Intervals.icu.
* **Daily Readiness & Recovery Ring (WHOOP Style)**:
  * Daily recovery score computed from HRV ($rMSSD$), resting heart rate, sleep metrics, and Form ($TSB$).
* **Fitness & Form Modeling (CTL / ATL / TSB)**:
  * **Fitness (CTL)**: 42-day rolling chronic training load.
  * **Fatigue (ATL)**: 7-day rolling acute training load.
  * **Form (TSB)**: $CTL - ATL$ with highlighted optimal performance zones.
* **Accurate Power Duration Curve**:
  * Realistic critical power duration curve breakdown across Sprint (5s/15s), Anaerobic (30s/1m), VO2 Max (2m/5m), Threshold (10m/20m), and Endurance (1h).
* **Biometrics & Wellness Trends**:
  * Longitudinal tracking for VO2max, HRV ($rMSSD$), Resting Heart Rate, and Sleep Duration/Quality.
* **Calendar & Workout Planner**:
  * View scheduled workouts from Intervals.icu with planned TSS and targets.
  * **"Ride in Studio"** button: instantly converts any scheduled workout into ERG intervals and loads it directly into the Smart Trainer HUD!

---

### 🎨 4. Google Material 3 Dark Theme
* **Color Palette**:
  * Background Scaffold: `#131316` (deep charcoal)
  * Surface Container: `#1F2025`
  * Surface Container High: `#26272D`
  * Surface Container Highest: `#2F3037`
  * Outline Variant / Borders: `#383941`
  * Primary Accent: `#A8C7FA` (Material You Blue)
  * Secondary / Mint Accent: `#6DD58C` / `#00E5A3`
  * Warning Accent: `#FDD663`
  * Error / Coral Accent: `#F28B82`
* **Pill Navigation & Cards**:
  * Floating pill navigation bar on desktop and mobile.
  * High-contrast typography and subtle rounded elevation cards.

---

## 📥 Downloads & Installation

Pre-built binaries can be downloaded directly from the [GitHub Releases](https://github.com/frr0/Cycling-App/releases) page:

### 📱 Android
1. Download `VeloPulse.apk`.
2. Sideload onto your device:
   ```bash
   adb install -r VeloPulse.apk
   ```
3. Grant Bluetooth and Location permissions when prompted.

### 🪟 Windows 11
1. Download `VeloPulse-win-x64.zip`.
2. Extract the archive and launch `VeloPulse.exe`.

### 🍏 macOS
1. Download `VeloPulse-mac-x64.zip`.
2. Extract and move `VeloPulse.app` to your `/Applications` folder.

### 🐧 Linux
1. Download `VeloPulse-linux-x86_64.AppImage` (or `VeloPulse-linux-x64.tar.gz`).
2. Make it executable and run:
   ```bash
   chmod +x VeloPulse-linux-x86_64.AppImage
   ./VeloPulse-linux-x86_64.AppImage --appimage-extract-and-run --no-sandbox
   ```
   *Or simply run the included universal launcher script:*
   ```bash
   ./VeloPulse-Linux.sh
   ```

---

## 🛠️ Development & Building from Source

### Prerequisites
* **Node.js**: v18+ or v20+
* **npm**: v9+
* **JDK 21**: Required for compiling the Android APK (`JAVA_HOME=~/.local/jdk21`)
* **Xcode 15+**: Required for compiling the iOS app (macOS only)

### Installation
```bash
git clone https://github.com/frr0/Cycling-App.git
cd Cycling-App
npm install
```

### 🌐 Run Web Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in Chrome, Edge, or Chromium.

### 🏗️ Build Production Web Assets
```bash
npm run build
```

### 🐧 Build Linux Desktop (AppImage & Tarball)
```bash
npm run dist:linux
```

### 🪟 Build Windows 11 Desktop (Zip & Directory)
```bash
npm run dist:win
```

### 🍏 Build macOS Desktop (Zip & App Bundle)
```bash
npm run dist:mac
```

### 📱 Build Android APK
```bash
npm run android:build
```
Outputs the ready-to-install `VeloPulse.apk`.

### 🍏 Build iOS Native Project
```bash
npm run ios:sync
npm run ios:open
```
Opens the project in Xcode for signing and deployment to physical iPhones or iPads.

---

## 📁 Repository Structure

```
Cycling/
├── android/                     # Capacitor native Android project (Gradle, BLE permissions, FIT export)
├── ios/                         # Capacitor native iOS project (Xcode project, Info.plist BLE capabilities)
├── electron/                    # Electron desktop runtime (Web Bluetooth, window management)
│   ├── assets/icon.png          # App icon (512x512)
│   └── main.cjs                 # Main Electron process
├── src/
│   ├── components/
│   │   ├── charts/              # Recharts components (Power Curve, HRV, Sleep, VO2 Max, Resting HR)
│   │   ├── views/               # App views (Dashboard, RideStudio, Fitness, Activities, ActivityDetail, Calendar, Profile)
│   │   ├── ActivityMap.tsx      # Leaflet interactive GPS map with Dark Matter & OSM tiles
│   │   ├── Navbar.tsx           # Google Material 3 pill navigation bar
│   │   ├── MetricCard.tsx       # Studio HUD telemetry cards
│   │   └── ...                  # Modals (Bluetooth, Settings, SessionSummary)
│   ├── context/                 # AppContext (Intervals.icu synchronization, auth credentials)
│   ├── services/
│   │   ├── bluetooth/           # FTMS, Cycling Power, Cadence, HR BLE client & simulator
│   │   ├── physics/             # Real-time cycling physics engine (aero drag, rolling resistance, slope)
│   │   ├── workout/             # Zwift .zwo XML parser & real-time ERG workout runner
│   │   ├── fit/                 # Garmin .FIT binary encoder (@garmin/fitsdk)
│   │   └── intervals/           # Intervals.icu REST client & mock datasets
│   └── utils/                   # HR & Coggan power zones, polyline decoder, formatters
├── VeloPulse.apk                # Pre-compiled Android APK
├── VeloPulse-Linux.sh           # Universal launcher script for Linux systems
├── package.json                 # Project dependencies and build scripts
├── tailwind.config.js           # Material 3 Dark color theme definitions
└── README.md                    # Project documentation
```

---

## 📄 License

This project is licensed under the MIT License.

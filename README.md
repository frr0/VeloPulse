# VeloPulse 🚴‍♂️⚡ | Indoor Cycling Studio & Intervals Analytics

**VeloPulse** is a unified, high-performance cycling platform merging **VeloTrain** (Indoor Smart Trainer Studio) and **Intervals Pulse** (Intervals.icu Athletic Performance & Recovery Analytics).

It runs seamlessly across three target platforms:
1. 🌐 **Web Application** (Vite + React 19 + TypeScript + Tailwind CSS)
2. 🐧 **Linux Desktop AppImage** (Electron standalone bundle with native Web Bluetooth & BlueZ)
3. 📱 **Android APK** (Capacitor Native BLE with background wake lock & direct .FIT export)

---

## 🌟 Key Features

### 🚴 1. Indoor Smart Trainer & Ride Studio
- **Bluetooth Sensor Connectivity**:
  - **Smart Trainer (FTMS & Cycling Power)**: Connects via Bluetooth FTMS (`0x1826`) or Cycling Power (`0x1818`). Live instantaneous power (W), 3s smoothing, cadence (RPM), and hardware flywheel speed.
  - **Bluetooth Cadence Sensor**: Dedicated crank cadence sensor support (`0x1816`).
  - **Bluetooth Heart Rate Monitor**: Live BPM, HR zones, and HR intensity tracking (`0x180D`).
  - **Virtual Cyclist Simulator Mode**: Full built-in simulation to ride and test workouts without requiring physical bike hardware.
- **Advanced Cycling Physics Engine**:
  - Calculates realistic road velocity ($\text{km/h}$, $\text{m/s}$, $\text{mph}$) and distance using aerodynamic drag ($C_d A$), rolling resistance ($C_{rr}$), rider mass, bike mass, and road gradient:
    $$F_{drive} = \frac{P_{watts} \cdot \eta}{v}, \quad F_{resist} = 0.5 \cdot \rho \cdot C_d A \cdot v^2 + C_{rr} \cdot m \cdot g + m \cdot g \cdot \sin(\theta)$$
  - Toggle between **Virtual Physics Speed** and **Trainer Flywheel Speed**.
- **Zwift (.zwo) Workout Runner & Auto ERG Control**:
  - Execute Zwift `.zwo` XML workouts or built-in presets (Sweet Spot, VO2 Max Boost, Over-Under Threshold, FTP Ramp Test, Active Recovery).
  - Automatically sends ERG mode target wattage to smart trainers via Bluetooth FTMS Control Point (`0x2AD9`).
  - Live ERG Bias adjustment (-20% to +20%) and interval skip forward/backward.
  - Multi-tone audio countdown beeps on interval transitions.
- **Garmin .FIT File Generation**:
  - Generates 100% compliant `.fit` activity files upon session finish using `@garmin/fitsdk`.
  - Second-by-second records with power, cadence, HR, speed, distance, normalized power, TSS, and IF.
  - Ready for 1-click upload to **Strava**, **Garmin Connect**, and **Intervals.icu**.

### 📈 2. Athletic Performance & Recovery Analytics (Intervals.icu)
- **Direct Intervals.icu Sync or 1-Click Demo Mode**:
  - Authenticate using your Intervals.icu API Key, or explore immediately using the simulated pro athlete dataset.
- **Daily Readiness & Recovery Ring (WHOOP Style)**:
  - Daily recovery gauge calculated from HRV ($rMSSD$), resting heart rate, sleep metrics, and Form ($TSB$).
- **Fitness & Form Modeling (CTL / ATL / TSB)**:
  - Interactive multi-line performance chart:
    - **Fitness (CTL)**: 42-day rolling chronic training load.
    - **Fatigue (ATL)**: 7-day rolling acute training load.
    - **Form (TSB)**: $CTL - ATL$ with optimal form highlight zones (-10 to -30).
- **Power Duration Curve**:
  - Critical power curve breakdown across Sprint (5s/15s), Anaerobic (30s/1m), VO2 Max (2m/5m), Threshold (10m/20m), and Endurance (1h).
- **Biometrics & Wellness Trends**:
  - Longitudinal tracking for VO2max, HRV, Resting Heart Rate, and Sleep Duration/Quality.
- **Activities Stream**:
  - Chronological activity log with TSS, Intensity Factor, Normalized Power, average watts, and heart rate zone distribution.
- **Calendar & Plan Integration**:
  - Inspect upcoming scheduled workouts from Intervals.icu with planned TSS and targets.
  - **"Ride in Studio"** button: instantly converts any scheduled workout into ERG intervals and loads it directly into the Smart Trainer HUD!

---

## 🚀 Running & Building

### 🌐 1. Web Application

#### Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in Chrome, Edge, or Chromium.

#### Production Web Build
```bash
npm run build
```
Generates production assets in `dist/`.

---

### 🐧 2. Linux Standalone AppImage

The AppImage packages the entire studio and analytics suite with native Web Bluetooth (BlueZ) support into a single standalone Linux binary:

```bash
# Run the built AppImage directly:
./run-app.sh
# Or directly:
./VeloPulse.AppImage
```

*(Note: If FUSE is not installed on your system, `run-app.sh` automatically adds `--appimage-extract-and-run`).*

#### Rebuild AppImage
```bash
npm run dist
```
Generates `release/VeloPulse-x86_64.AppImage` and updates `./VeloPulse.AppImage`.

---

### 📱 3. Android APK

An installable Android APK is pre-compiled at:
👉 [**`VeloPulse.apk`**](file:///home/francesco/Progetti/Cycling/VeloPulse.apk)

#### Sideload to Phone:
```bash
adb install -r VeloPulse.apk
```

#### Rebuild Android APK:
```bash
npm run android:build
```
This syncs web assets with Capacitor, runs Gradle with JDK 21 (`~/.local/jdk21`), and outputs the updated `VeloPulse.apk`.

---

## 🛠️ Project Structure

```
Cycling/
├── android/               # Capacitor Android project (Gradle, BLE permissions, FIT downloader)
├── electron/              # Electron desktop wrapper (Web Bluetooth, fullscreen, file saves)
├── src/
│   ├── components/
│   │   ├── charts/        # Recharts Power Curve, VO2max, HRV, Sleep, Resting HR
│   │   ├── views/         # DashboardView, RideStudioView, FitnessView, ActivitiesView, CalendarView, ProfileView
│   │   ├── Navbar.tsx     # Unified header & navigation bar with live BLE status
│   │   ├── MetricCard.tsx # Dual HUD / compact metric display card
│   │   └── ...            # Modals (Bluetooth, Workout, Settings, SessionSummary)
│   ├── context/           # AppContext (Intervals.icu sync, auth, wellness, metrics)
│   ├── services/
│   │   ├── bluetooth/     # FTMS, CSC, HR BLE services & virtual simulator
│   │   ├── physics/       # Cycling speed, aero drag, rolling resistance calculator
│   │   ├── workout/       # Zwift .zwo XML parser & real-time ERG workout engine
│   │   ├── fit/           # Garmin .FIT binary generator (@garmin/fitsdk)
│   │   └── intervals/     # Intervals.icu REST API client & mock dataset
│   └── utils/             # Coggan power zones, HR zones, formatters, workout converter
├── VeloPulse.AppImage     # Pre-built standalone Linux desktop AppImage
├── VeloPulse.apk          # Pre-built installable Android APK
└── run-app.sh             # Linux launcher script
```

---

## 🔒 Version Control

This repository is initialized locally with Git (no remote/GitHub configured):
```bash
git status
git log
```

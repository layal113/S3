# Miqyas Energy

Initial mobile-first frontend foundation for an energy dashboard. It uses Expo SDK 57, React Native, and strict TypeScript, and is intended to run on Android, iOS, and web.

This phase intentionally contains one screen and simulated data only. It does not connect to a backend, prediction model, disaggregation model, or AI service.

## Requirements

- Node.js 22.13 or newer (the minimum supported by Expo SDK 57)
- npm
- Expo Go on a compatible physical device, or Android Studio/Xcode for a simulator
- Xcode and macOS are required for the iOS Simulator

## Install and run

```sh
npm install
npm start
```

After the development server starts, scan the QR code with Expo Go or use a platform shortcut. You can also launch a target directly:

```sh
npm run android
npm run ios
npm run web
```

`npm run android` and `npm run ios` require a configured emulator/simulator. For Expo Go, keep the computer and phone on the same network, start with `npm start`, and scan the displayed QR code.

## Configuration

Copy `.env.example` to `.env` for local configuration:

```sh
cp .env.example .env
```

The future backend base URL is configured with `EXPO_PUBLIC_API_BASE_URL`. Values prefixed with `EXPO_PUBLIC_` are embedded in the client bundle and must never contain secrets.

## Architecture

- `App.tsx` is the application entry component and injects the selected dashboard service.
- `src/navigation/` defines the bottom-tab navigation shared by mobile and web.
- `src/screens/` contains the one screen implemented in this phase.
- `src/components/` contains reusable dashboard presentation components.
- `src/types/` owns shared dashboard contracts.
- `src/services/` defines `DashboardService` and selects its current implementation.
- `src/data/` contains the single internally consistent simulated dataset.
- `src/hooks/` manages asynchronous loading, success, retry, and error state.
- `src/theme/` centralizes visual design tokens.
- `src/config/` reads public environment configuration for future integration.
- `src/utils/` contains display-formatting helpers.

The Home tab is the only implemented product screen. Insights, Recommendations, and Profile are navigation placeholders for later phases.

The Home screen depends only on the `DashboardService` interface, never on the raw mock dataset. When the backend is ready, implement the same interface with an API client and change the service composition in `src/services/index.ts`. No dashboard presentation rewrite should be necessary.

## Placeholder API contract

The app still makes no network requests. Future REST paths are centralized in `src/config/apiEndpoints.ts` so backend integration can happen without scattering URLs through the UI.

| Method | Path                                           | Purpose                                                                   |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------- |
| `GET`  | `/v1/households`                               | List households available to the user                                     |
| `GET`  | `/v1/households/:householdId`                  | Household details                                                         |
| `GET`  | `/v1/households/:householdId/dashboard`        | Complete Home dashboard snapshot                                          |
| `GET`  | `/v1/households/:householdId/usage/current`    | Current kWh and estimated cost                                            |
| `GET`  | `/v1/households/:householdId/forecast`         | Predicted usage, bill, and comparison                                     |
| `GET`  | `/v1/households/:householdId/tariff-status`    | Current tier, threshold, and remaining kWh                                |
| `GET`  | `/v1/households/:householdId/appliances/usage` | Appliance breakdown                                                       |
| `GET`  | `/v1/households/:householdId/usage/history`    | Usage history; later accepts period, unit, and appliance query parameters |
| `GET`  | `/v1/households/:householdId/recommendations`  | Energy-saving recommendations                                             |

All paths are relative to `EXPO_PUBLIC_API_BASE_URL`. The existing local mock services remain the active data source.

## Quality checks

```sh
npm run typecheck
npm run lint
npm run format:check
```

To verify a production-style JavaScript bundle for every supported platform, run:

```sh
npx expo export --platform all
```

# TripLedger

PWA + Android + iOS app to manage group trips: finances, itinerary, and a social feed.

## Stack

- Expo (Router) + TypeScript
- Firebase Auth, Firestore, Storage (`tripledger-app`)
- EAS Build for native binaries
- Web export + service worker for PWA

## Setup

```bash
npm install
npx expo start
```

Web / PWA:

```bash
npx expo export -p web
# serve the `dist` folder (includes public/manifest.json and sw.js)
```

Native builds (requires Expo account):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
eas build -p ios --profile production
```

## Firebase

Project: `tripledger-app` (Firestore em `southamerica-east1`)

Deploy rules:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,storage --project tripledger-app
```

**Web (Hosting):** https://tripledger-app.web.app  

**Storage:** com billing ativo, abra https://console.firebase.google.com/project/tripledger-app/storage e clique em **Get Started** se o bucket ainda não existir (necessário para comprovantes/fotos).

Auth: e-mail/senha e Google Sign-In foram provisionados via Firebase CLI. Inclua `tripledger-app.web.app` e `tripledger-app.firebaseapp.com` em Authentication → Settings → Authorized domains.
## Main flows

1. Register / login
2. Create a trip (creator becomes admin + finance lead) or join via invite code
3. Finances: planned/actual expenses, splits, payments with proof, consolidation
4. Itinerary: day cards with images, RSVP, done state
5. Feed: photos/videos, likes, comments
6. Closing report: balances + simplified settlements

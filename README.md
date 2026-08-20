# eduShare

Share Minecraft Education server codes with your class. Register a server, set a
ruleset, and let players unlock the join code with a slot-machine reveal after
they agree to the rules.

Built with React + TypeScript (Vite), Tailwind CSS, Framer Motion, and Firebase
(Auth + Firestore).

## Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Authentication → Email/Password** and **Firestore Database**.
3. Copy `.env.example` to `.env` and fill in your Firebase web app config
   (Project settings → General → Your apps → SDK setup and configuration):

   ```
   cp .env.example .env
   ```

4. Install dependencies and start the dev server:

   ```
   npm install
   npm run dev
   ```

5. Deploy Firestore rules (`firestore.rules` is already wired up in
   `firebase.json`):

   ```
   firebase deploy --only firestore:rules
   ```

## Deploying

```
npm run build
firebase deploy --only hosting
```

## Note on join codes

Join codes are stored on the server document and only *revealed in the UI*
after a player agrees to the rules — the code isn't fetched from a separate
protected source. That's enough to stop casual code-sharing among students,
but a technically savvy user could read a code straight from the network
request. If that matters for your use case, move code storage behind a Cloud
Function that checks agreement server-side before returning it.

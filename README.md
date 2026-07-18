# Investition Dashboard v15 – E-Mail + Passwort

Diese Version ersetzt Magic Link und OTP als reguläre Anmeldung durch Supabase E-Mail/Passwort.

## GitHub-Dateien

Alle Dateien dieses Ordners direkt in das Hauptverzeichnis des Repositorys `investition-dashboard` hochladen:

- `index.html`
- `app.js`
- `supabase.js`
- `news.js`
- `service-worker.js`
- `reset.html`
- `startdaten.json`
- `.nojekyll`

Danach `https://schuelo.github.io/investition-dashboard/reset.html?v=15` öffnen, den Cache zurücksetzen und anschließend das Dashboard neu öffnen.

## Supabase konfigurieren

1. Supabase-Projekt öffnen.
2. `Authentication` → `Sign In / Providers` → `Email` öffnen.
3. Email-Provider aktiv lassen.
4. `Confirm email` deaktivieren.
5. `Allow new users to sign up` für die erste Kontoerstellung aktivieren.
6. Änderungen speichern.

Nach Erstellung deines einzigen Kontos `Allow new users to sign up` wieder deaktivieren. Bestehende Benutzer können sich weiterhin anmelden.

## Bereits vorhandenes Magic-Link-/OTP-Konto

Wenn du im Safari-Dashboard noch angemeldet bist:

1. Dashboard in Safari öffnen.
2. `Cloud verbunden` öffnen.
3. Unter `Passwort festlegen oder ändern` zweimal ein neues Passwort eingeben.
4. `Passwort speichern` drücken.
5. In der Home-Screen-App mit derselben E-Mail und dem neuen Passwort anmelden.

Wenn keine Sitzung mehr aktiv ist:

1. E-Mail im Dashboard eingeben.
2. `Einmaliger Einrichtungslink` drücken.
3. Link aus der Supabase-E-Mail in Safari öffnen.
4. Im Cloud-Fenster ein Passwort festlegen.
5. Danach in der Home-Screen-App regulär mit E-Mail und Passwort anmelden.

Dafür ist kein eigener SMTP-Anbieter erforderlich; der eingebaute Supabase-Maildienst kann jedoch stark begrenzt sein.

## Neues Konto

1. E-Mail und ein Passwort mit mindestens acht Zeichen eingeben.
2. `Konto anlegen` drücken.
3. Nach erfolgreicher Kontoerstellung lokale Pläne in die Cloud übernehmen.
4. In Supabase neue Registrierungen wieder deaktivieren.

## Regelmäßige Anmeldung

Danach werden keine Magic Links oder OTP-Codes mehr benötigt. Die Anmeldung erfolgt mit `signInWithPassword`; die Sitzung wird innerhalb von Safari beziehungsweise der Home-Screen-App separat gespeichert.

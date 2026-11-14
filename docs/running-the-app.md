# Running SwapCycle on your computer

This guide takes you from the GitHub repository to a working copy of SwapCycle in your browser. It works on Windows,
macOS and Linux and takes about 15 minutes the first time, most of it downloading and building.

SwapCycle is a web application. A PostgreSQL database and the C++ API run inside Docker, and the website runs with
Node.js. Then you open it in a browser.

---

## 1. Install the tools (once)

| Tool | Why | Get it |
|---|---|---|
| **Git** | Download the code | https://git-scm.com/downloads (on Windows this also installs **Git Bash**) |
| **Docker Desktop** | Runs the database and the API | https://www.docker.com/products/docker-desktop/ |
| **Node.js 22 LTS** (20.19+ also works) | Runs the website | https://nodejs.org/ |

After installing, **open Docker Desktop and wait until it says it is running**. It must stay open while you use the app.
On Windows, Docker Desktop may ask to install or update WSL 2. Accept and restart if asked.

Check that everything is installed. Each command should print a version number:

```bash
git --version
docker --version
node --version
```

**Which terminal?** On Windows, use **Git Bash** (or a Git Bash terminal in VS Code: *Terminal → New Terminal*, then
pick *Git Bash* from the ⌄ menu). Every command below is written for Git Bash, macOS Terminal or Linux. Where
PowerShell needs something different, the alternative is shown.

---

## 2. Download the code

```bash
git clone https://github.com/sama-elsawaf/SwapCycle-SWEN.git
cd SwapCycle-SWEN
```

To use VS Code, open the `SwapCycle-SWEN` folder with *File → Open Folder…* and run the rest of the commands in its
terminal.

---

## 3. Create your settings file (`.env`)

The app reads its settings from a file called `.env`, which never goes into Git. Start from the example:

```bash
cp .env.example .env
```

PowerShell: `Copy-Item .env.example .env`

Open `.env` in an editor and fill in **two values**. Do this **before** starting the app for the first time (see the
note below).

1. **`SESSION_SECRET`**: required, at least 32 random characters. Generate one with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```
   Paste the output after `SESSION_SECRET=`.
2. **`POSTGRES_PASSWORD`**: replace `change-me` with any password of your own. You can run the same command again to
   generate one.

Leave everything else as it is.

> **Why before the first start?** The database saves its password the first time it starts. If you change
> `POSTGRES_PASSWORD` later, the API can no longer connect. To fix that, reset the database as described in
> [Troubleshooting](#7-troubleshooting).

Never commit `.env` or share it. Git already ignores it.

---

## 4. Start the database and the API

From the `SwapCycle-SWEN` folder:

```bash
docker compose up -d --build
```

The first run downloads and compiles the backend, which takes a few minutes. Later starts take seconds. This command:

- starts **PostgreSQL 16** and creates every table from `database/migrations/`;
- starts the **API** on http://localhost:8080.

Check it is running (both services should say `Up`, and the database `healthy`):

```bash
docker compose ps
```

Open http://localhost:8080/api/meeting-areas in a browser. A list of campus areas means the API works.

---

## 5. Add demo data (optional, recommended)

This adds three readers and a moderator, with books and wish lists, so the app is not empty:

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/seeds/dev_seed.sql
```

PowerShell:
```powershell
Get-Content database\seeds\dev_seed.sql -Raw | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

It is safe to run more than once. The demo accounts all use the password **`password123`**:

| Email | Who |
|---|---|
| `sara@example.com` | Reader. Offers a mystery and *Dune*, wants a travel book |
| `ali@example.com` | Reader. Offers a travel book, wants a biography and *Dune* |
| `noor@example.com` | Reader. Offers a biography, wants Sara's mystery |
| `moderator@example.com` | Moderator account |

Sara, Ali and Noor form the three-way swap from the README. These accounts are for local testing only.

---

## 6. Start the website

Open a **second terminal** in the same folder (leave it running while you use the app):

```bash
cd frontend
npm ci
npm run dev
```

`npm ci` installs the exact package versions the project was tested with. You only need it the first time and after
pulling changes that touch `package-lock.json`. After that, `npm run dev` alone is enough.

Open **http://localhost:5173**. Log in with a demo account, or choose **Get Started** to register your own.

### Stopping and starting again

| What | Command |
|---|---|
| Stop the website | Press `Ctrl + C` in its terminal |
| Stop the database and API (your data is kept) | `docker compose down` |
| Start again later | Open Docker Desktop, run `docker compose up -d`, then `cd frontend && npm run dev` |
| Get the latest code | `git pull`, then `docker compose up -d --build` and `cd frontend && npm ci` |

### Trying it on a phone (same Wi-Fi)

1. In `.env`, set `COOKIE_SECURE=false`, then run `docker compose up -d`. Without this, phones are logged straight
   back out, because over plain `http://` browsers only accept the login cookie from `localhost`.
2. Start the website with `npm run dev -- --host`. It prints a **Network** address such as
   `http://192.168.1.23:5173`.
3. Open that address in the phone's browser. If Windows asks, allow Node.js on **private** networks.

Set `COOKIE_SECURE=true` again when you are done. University and guest Wi-Fi often block phone-to-laptop
connections; a home network or a phone hotspot works.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `failed to connect to the docker API` / `dockerDesktopLinuxEngine` | Docker Desktop is not running. Open it and wait until it says it is running. |
| `docker compose ps` shows the backend `Exited` | Run `docker compose logs backend`. `SESSION_SECRET is required` or `must be at least 32 characters` means step 3 was missed: fix `.env`, then `docker compose up -d`. |
| Backend log says `password authentication failed` | `POSTGRES_PASSWORD` changed after the first start. Reset the database (below). |
| Logging in fails right after `git pull`, or the log mentions a missing column | A new migration arrived, and migrations only run on an empty database. Reset the database (below). |
| `port is already allocated` / `address already in use` | Another program uses that port. The database uses **5433** on your computer; change `POSTGRES_HOST_PORT` in `.env` if needed. The API needs **8080** and the website **5173**: close whatever uses them. |
| Pages say "Something went wrong" and the website terminal shows `http proxy error` | The API is not running. Check `docker compose ps` and the backend log. |
| `npm ci` fails | Check `node --version` is 20.19+ or 22.12+. |
| Password reset email never arrives | Expected for now: the app does not send email yet, it only logs that a reset was requested. |

**Reset the database** (deletes all local data, including accounts and uploaded photos):

```bash
docker compose down -v
docker compose up -d --build
```

Then add the demo data again (step 5).

Still stuck? Run `docker compose logs backend` and include the last lines when you ask for help. The logs never
contain passwords or session tokens.

---

## For developers

- Running the tests (frontend, backend, API scripts, sanitizer build): [`docs/testing.md`](testing.md)
- API reference: [`docs/api/openapi.yaml`](api/openapi.yaml)
- Connect a database tool to `localhost:5433` with the user, password and database name from `.env`.

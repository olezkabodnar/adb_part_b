# Offline-first Movies

A small plain-JavaScript Schema A movie app using PouchDB 9.0.0. The local
`movies_local` database replicates both ways with CouchDB's `movies_a` database.

## Run it

1. Start CouchDB and make sure `movies_a` exists with the Schema A documents
   (`title`, `actors`, and `genres`).
2. Enable CORS in CouchDB. Allow the origin used to serve this app, for example
   `http://127.0.0.1:5500` for VS Code Live Server or
   `http://127.0.0.1:8080` for the command below. Also allow
   `http://localhost:5500` or `http://localhost:8080` if you use those hostnames.
   If your CouchDB CORS settings have a credentials option, enable it.
3. Serve this folder over HTTP using VS Code Live Server, or run
   `npx http-server . -p 8080` from `adb_part_b`.
4. Open the served `index.html`. The sample CouchDB connection is
   `http://127.0.0.1:5984/movies_a` with `admin` / `password`; change those
   values in `script.js` if your local CouchDB credentials differ.

The credentials are intentionally included only for this local coursework
example. Do not publish this app or expose these credentials on a public
network. Load the app while online so the PouchDB CDN script is available; keep
the page open when testing offline.

## Test offline and sync

- With the app open and initially connected, stop CouchDB:
  `docker stop couchdb`
- The browser and local database remain usable. Add, edit, or delete movies and
  check the activity log and browser/sync status.
- Start CouchDB again:
  `docker start couchdb`
- Keep the app open; live retrying replication should resume automatically.
  Check the status and activity log, and verify the changes in Fauxton.

To make a conflict, leave CouchDB running and open Fauxton in another tab. In
the app tab, use the browser's developer tools to set that tab's network to
offline. Edit a movie in the app, then edit that same movie in Fauxton. Set the
app tab back online; replication should bring both edits together. The list
marks conflicted movies; use **View and resolve conflict** to inspect both
versions and keep one. The other revision(s) are deleted.

The app lists at most 50 title-search results. Movie writes are made to the local
PouchDB first, and its live changes feed refreshes the list as local or
replicated changes arrive.

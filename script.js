// Database setup and CRUD follow the PouchDB getting started example:
// https://pouchdb.com/getting-started.html
const localDB = new PouchDB("movies_local");
const remoteDB = new PouchDB("http://127.0.0.1:5984/movies_a", {
  auth: { username: "admin", password: "password" }
});

const elements = {
  onlineStatus: document.getElementById("onlineStatus"),
  syncStatus: document.getElementById("syncStatus"),
  error: document.getElementById("error"),
  form: document.getElementById("movieForm"),
  formHeading: document.getElementById("formHeading"),
  title: document.getElementById("title"),
  actors: document.getElementById("actors"),
  genres: document.getElementById("genres"),
  saveButton: document.getElementById("saveButton"),
  cancelEditButton: document.getElementById("cancelEditButton"),
  search: document.getElementById("search"),
  resultCount: document.getElementById("resultCount"),
  movieList: document.getElementById("movieList"),
  conflictPanel: document.getElementById("conflictPanel"),
  conflictVersions: document.getElementById("conflictVersions"),
  closeConflictButton: document.getElementById("closeConflictButton"),
  log: document.getElementById("log")
};

let editingId = null;
let refreshNumber = 0;

function addLog(message) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
  elements.log.prepend(item);
  while (elements.log.children.length > 20) {
    elements.log.lastElementChild.remove();
  }
}

function showError(context, error) {
  const detail = error && error.message ? error.message : String(error);
  elements.error.textContent = `${context}: ${detail}`;
  elements.error.hidden = false;
  addLog(`Error: ${context} (${detail})`);
}

function clearError() {
  elements.error.textContent = "";
  elements.error.hidden = true;
}

function setSyncStatus(status, detail) {
  elements.syncStatus.textContent = detail ? `${status}: ${detail}` : status;
}

function splitValues(value) {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function appendText(parent, tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  parent.appendChild(node);
  return node;
}

async function refreshMovies() {
  const thisRefresh = ++refreshNumber;
  try {
    const result = await localDB.allDocs({ include_docs: true });
    const query = elements.search.value.trim().toLocaleLowerCase();
    const movies = result.rows
      .map((row) => row.doc)
      .filter((doc) => doc && !doc._deleted && typeof doc.title === "string")
      .filter((doc) => doc.title.toLocaleLowerCase().includes(query))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 50);

    const withConflicts = await Promise.all(movies.map(async (movie) => {
      const latest = await localDB.get(movie._id, { conflicts: true });
      return { ...latest, _conflicts: latest._conflicts || [] };
    }));
    if (thisRefresh !== refreshNumber) return;

    elements.movieList.replaceChildren();
    elements.resultCount.textContent = `${withConflicts.length} movie(s) shown (maximum 50).`;

    if (withConflicts.length === 0) {
      appendText(elements.movieList, "p", "No movies found.", "muted");
      return;
    }

    for (const movie of withConflicts) {
      const card = document.createElement("article");
      card.className = "movie";
      appendText(card, "h3", movie.title);
      appendText(card, "p", `Actors: ${(movie.actors || []).join(", ") || "None"}`);
      appendText(card, "p", `Genres: ${(movie.genres || []).join(", ") || "None"}`);

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => beginEdit(movie));
      card.appendChild(editButton);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteMovie(movie._id));
      card.appendChild(deleteButton);

      if (movie._conflicts.length > 0) {
        appendText(card, "p", `Conflict: ${movie._conflicts.length} other revision(s)`, "status");
        const conflictButton = document.createElement("button");
        conflictButton.type = "button";
        conflictButton.textContent = "View and resolve conflict";
        conflictButton.addEventListener("click", () => showConflictVersions(movie._id));
        card.appendChild(conflictButton);
      }
      elements.movieList.appendChild(card);
    }
  } catch (error) {
    showError("Could not load movies", error);
  }
}

function resetForm() {
  editingId = null;
  elements.form.reset();
  elements.formHeading.textContent = "Add a movie";
  elements.saveButton.textContent = "Add movie";
  elements.cancelEditButton.hidden = true;
}

function beginEdit(movie) {
  editingId = movie._id;
  elements.title.value = movie.title || "";
  elements.actors.value = (movie.actors || []).join(", ");
  elements.genres.value = (movie.genres || []).join(", ");
  elements.formHeading.textContent = "Edit a movie";
  elements.saveButton.textContent = "Save changes";
  elements.cancelEditButton.hidden = false;
  elements.title.focus();
}

async function saveMovie(event) {
  event.preventDefault();
  clearError();
  const fields = {
    title: elements.title.value.trim(),
    actors: splitValues(elements.actors.value),
    genres: splitValues(elements.genres.value)
  };
  if (!fields.title) {
    showError("Could not save movie", new Error("Title is required."));
    return;
  }

  try {
    if (editingId) {
      const current = await localDB.get(editingId);
      await localDB.put({ ...current, ...fields });
      addLog(`Updated "${fields.title}" in the local database.`);
    } else {
      await localDB.post(fields);
      addLog(`Added "${fields.title}" to the local database.`);
    }
    resetForm();
    await refreshMovies();
  } catch (error) {
    showError("Could not save movie", error);
  }
}

async function deleteMovie(id) {
  clearError();
  try {
    const movie = await localDB.get(id);
    await localDB.remove(movie);
    addLog(`Deleted "${movie.title}" from the local database.`);
    if (editingId === id) resetForm();
    await refreshMovies();
  } catch (error) {
    showError("Could not delete movie", error);
  }
}

async function showConflictVersions(id) {
  clearError();
  try {
    const result = await localDB.get(id, { open_revs: "all" });
    const versions = result.filter((item) => item.ok).map((item) => item.ok);
    elements.conflictVersions.replaceChildren();
    elements.conflictPanel.hidden = false;

    if (versions.length < 2) {
      appendText(elements.conflictVersions, "p", "No competing versions are available now.");
      return;
    }

    for (const version of versions) {
      const article = document.createElement("article");
      appendText(article, "h3", version._deleted ? "Deleted version" : (version.title || "Untitled"));
      appendText(article, "p", `Revision: ${version._rev}`);
      appendText(article, "p", `Actors: ${(version.actors || []).join(", ") || "None"}`);
      appendText(article, "p", `Genres: ${(version.genres || []).join(", ") || "None"}`);
      const keepButton = document.createElement("button");
      keepButton.type = "button";
      keepButton.textContent = "Keep this version";
      keepButton.addEventListener("click", () => resolveConflict(id, version._rev));
      article.appendChild(keepButton);
      elements.conflictVersions.appendChild(article);
    }
  } catch (error) {
    showError("Could not read conflict versions", error);
  }
}

async function resolveConflict(id, chosenRevision) {
  clearError();
  try {
    const result = await localDB.get(id, { open_revs: "all" });
    const versions = result.filter((item) => item.ok).map((item) => item.ok);
    if (!versions.some((version) => version._rev === chosenRevision)) {
      throw new Error("That version is no longer available. Reopen the conflict and choose again.");
    }

    for (const version of versions) {
      if (version._rev !== chosenRevision) {
        await localDB.remove({ _id: version._id, _rev: version._rev });
      }
    }
    elements.conflictPanel.hidden = true;
    addLog(`Resolved conflict for movie ${id}; kept revision ${chosenRevision}.`);
    await refreshMovies();
  } catch (error) {
    showError("Could not resolve conflict", error);
  }
}

function updateOnlineStatus() {
  const online = navigator.onLine;
  elements.onlineStatus.textContent = online ? "Online" : "Offline";
  addLog(`Browser is ${online ? "online" : "offline"}.`);
}

elements.form.addEventListener("submit", saveMovie);
elements.cancelEditButton.addEventListener("click", resetForm);
elements.search.addEventListener("input", refreshMovies);
elements.closeConflictButton.addEventListener("click", () => {
  elements.conflictPanel.hidden = true;
});
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

updateOnlineStatus();
refreshMovies();

// Keep the visible list in step with local writes and replicated changes.
localDB.changes({ since: "now", live: true, include_docs: true })
  .on("change", () => refreshMovies())
  .on("error", (error) => showError("Local change feed stopped", error));

const sync = localDB.sync(remoteDB, { live: true, retry: true });
sync
  .on("active", () => {
    setSyncStatus("active");
    addLog("Replication is active.");
  })
  .on("paused", (error) => {
    if (error) {
      setSyncStatus("paused", error.message);
      addLog(`Replication paused: ${error.message}`);
    } else {
      setSyncStatus("paused");
      addLog("Replication is up to date and paused.");
    }
  })
  .on("change", (info) => {
    setSyncStatus("change");
    const counts = info.change || {};
    addLog(`Replication change: ${counts.docs_written || 0} document(s) written.`);
  })
  .on("denied", (error) => {
    setSyncStatus("error", error.message);
    showError("Replication was denied", error);
  })
  .on("error", (error) => {
    setSyncStatus("error", error.message);
    showError("Replication failed", error);
  });

// Saves options to chrome.storage
function save_options() {
  var status = document.getElementById("status");
  var wsServer = document.getElementById("websocket-server").value;

  if (!wsServer || wsServer.length < 1) {
    wsServer = "ws://localhost:8080/";
  }
  chrome.storage.local.set(
    {
      serverPath: wsServer,
    },
    function () {
      // Update status to let user know options were saved
      status.textContent = "Options saved.";
      setTimeout(function () {
        status.textContent = "";
      }, 750);

      // Notify everyone that options have changed
      chrome.runtime.sendMessage("notifyOptionsUpdated");
    }
  );
}

// Restores text box using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value null
  chrome.storage.local.get(
    {
      serverPath: null,
    },
    function (items) {
      document.getElementById("websocket-server").value = items.serverPath;
    }
  );
}

// Setup event listeners
document.addEventListener("DOMContentLoaded", restore_options);
document.getElementById("save").addEventListener("click", save_options);

chrome.browserAction.onClicked.addListener(function (event) {
  let meetUrl = "https://meet.google.com";

  chrome.tabs.getAllInWindow(undefined, function (tabs) {
    for (let i = 0, tab; (tab = tabs[i]); i++) {
      if (tab.url && tab.url.includes(meetUrl)) {
        chrome.tabs.update(tab.id, { selected: true });
        return;
      }
    }
    chrome.tabs.create({ url: meetUrl });
  });
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message == "getTabId") {
    if (
      sender.tab &&
      sender.tab.id &&
      sender.tab.id !== chrome.tabs.TAB_ID_NONE
    ) {
      sendResponse(sender.tab.id);
    } else {
      sendResponse(null);
    }
  } else if (message == "notifyOptionsUpdated") {
    let meetUrl = "https://meet.google.com";
    chrome.tabs.getAllInWindow(undefined, function (tabs) {
      for (let i = 0, tab; (tab = tabs[i]); i++) {
        if (tab.url && tab.url.includes(meetUrl)) {
          chrome.tabs.sendMessage(tab.id, message);
          return;
        }
      }
    });
  } else if (message == "enterFullscreen") {
    chrome.windows.getCurrent(function (curWindow) {
      if (
        curWindow.state &&
        curWindow.state != "fullscreen" &&
        curWindow.state != "locked-fullscreen"
      ) {
        chrome.windows.update(curWindow.id, { state: "fullscreen" });
      }
    });
  } else if (message == "exitFullscreen") {
    chrome.windows.getCurrent(function (curWindow) {
      if (
        curWindow.state &&
        (curWindow.state == "fullscreen" ||
          curWindow.state == "locked-fullscreen")
      ) {
        chrome.windows.update(curWindow.id, { state: "normal" });
      }
    });
  }
});

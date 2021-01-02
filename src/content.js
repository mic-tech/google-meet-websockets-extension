var serverPath = null;
var wsClient = null;
var wsIsConnected = false;

var state = {
  dialogs: new Map(),
  tabId: null,
  meetingsToday: new Map(),
  meeting: {
    id: null,
    myId: null,
    joining: {
      needsPermissionToJoin: false,
      canUsePhoneForAudio: false,
      displayStatus: null,
      joinInfo: {
        url: null,
        phone: null,
        pin: null,
      },
    },
    selfParticipantId: null,
    muted: false,
    cameraOn: false,
    handRaised: false,
    captionsEnabled: false,
    chat: [],
    participants: new Map(),
    joinRequest: null,
    selfTiled: false,
    participantPinned: null,
  },
  page: "unknown",
};

var readyStateCheckTimeout = null;
var stateUpdateTimeout = null;
var meetingJoinDisplayStatusObserver = null;
var meetingChatObserver = null;
var wsConnectTimeout = null;

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function extractParticipantId(idStr) {
  let _lIdx = 0;
  return idStr && idStr.length > 1 && (_lIdx = idStr.lastIndexOf("/")) !== -1
    ? idStr.substring(_lIdx + 1)
    : idStr;
}

function extractMeetingJoiningPhonePin(text) {
  ret = {
    phone: null,
    pin: null,
  };

  if (!text || text.length < 1) return ret;
  let _text = text.toLowerCase();

  if (_text.includes("dial-in:") && _text.includes("pin:")) {
    ret.phone = _text.substring(_text.indexOf("dial-in:"));
    ret.phone = ret.phone
      .substring(ret.phone.indexOf("+"), ret.phone.indexOf("pin:"))
      .trim();
    ret.pin =
      _text.substring(_text.indexOf("pin:") + 4, _text.indexOf("#")).trim() +
      "#";
  }

  return ret;
}

function getDateFromTimestamp(timestamp) {
  if (!timestamp || !isNumeric(timestamp)) return null;
  return new Date(parseFloat(timestamp));
}

function getTimestampFromDate(date) {
  if (!date || date.length < 2) return null;
  let _now = new Date();
  return Date.parse(
    _now.getMonth() +
      "/" +
      _now.getDate() +
      "/" +
      _now.getFullYear() +
      " " +
      date
  );
}

// Wait until an element is found in the DOM of specified document
// if maxWait not specified, wait indefinitely
function waitForElement(elementPath, doc, callback, maxWait = 0) {
  var waitfor = elementPath === '[data-call-ended = "true"]' ? 10000 : 500;
  var numChecks = 0;
  var maxWaitTimes = maxWait;

  var _waitForElementInterval = setInterval(function () {
    numChecks++;
    let itExists = doc.querySelector(elementPath);
    if (!itExists || itExists.length === 0) {
      if (maxWaitTimes && numChecks >= maxWaitTimes) {
        // we're done, not found
        clearInterval(_waitForElementInterval);
        callback(elementPath, itExists);
      }
      // otherwise, keep waiting
    } else {
      clearInterval(_waitForElementInterval);
      callback(elementPath, itExists);
    }
  }, waitfor);
}

// Wait until a predicate function returns true
// if maxWait not specified, wait indefinitely
function waitForCondition(predicateFunction, callback, maxWait = 0) {
  var numChecks = 0;
  var maxWaitTimes = maxWait;

  var _waitForConditionInterval = setInterval(function () {
    numChecks++;
    if (!predicateFunction()) {
      if (maxWaitTimes && numChecks >= maxWaitTimes) {
        // we're done
        clearInterval(_waitForConditionInterval);
        callback(false);
      }
      // otherwise, keep waiting
    } else {
      clearInterval(_waitForConditionInterval);
      callback(true);
    }
  }, 500);
}

function getJoinButton(doc = document) {
  let _btnDOMArray = doc.querySelectorAll(
    '[role="button"][aria-disabled="false"]'
  );
  for (let i = 0; i < _btnDOMArray.length; i++) {
    if (
      _btnDOMArray[i] &&
      (_btnDOMArray[i].textContent.toLowerCase() === "ask to join" ||
        _btnDOMArray[i].textContent.toLowerCase() === "join now")
    ) {
      return _btnDOMArray[i];
    }
  }
  return null;
}

function getButtonWithLabel(doc, buttonLabel, labelIsCaseSensitive = false) {
  let _btnDOMArray = doc.querySelectorAll('[role="button"]');

  let _labelToLookFor =
    buttonLabel && buttonLabel.length > 0 ? buttonLabel : "";
  if (!labelIsCaseSensitive) {
    _labelToLookFor = _labelToLookFor.toLowerCase();
  }

  let _btnLabel = null;
  for (let i = 0; i < _btnDOMArray.length; i++) {
    _btnLabel = null;
    if (
      _btnDOMArray[i] &&
      (_btnDOMArray[i].hasAttribute("aria-label") ||
        _btnDOMArray[i].textContent)
    ) {
      if (_btnDOMArray[i].hasAttribute("aria-label")) {
        _btnLabel = _btnDOMArray[i].getAttribute("aria-label");
        if (!labelIsCaseSensitive && _btnLabel && _btnLabel.length > 0)
          _btnLabel = _btnLabel.toLowerCase();
      }

      if (!_btnLabel || _btnLabel.length < 1) {
        _btnLabel = labelIsCaseSensitive
          ? _btnDOMArray[i].textContent
          : _btnDOMArray[i].textContent.toLowerCase();
      }

      if (_btnLabel === _labelToLookFor) {
        return _btnDOMArray[i];
      }
    }
  }
  return null;
}

function getButtonContainingLabel(
  doc,
  buttonLabel,
  labelIsCaseSensitive = false
) {
  let _btnDOMArray = doc.querySelectorAll('[role="button"]');

  let _labelToLookFor =
    buttonLabel && buttonLabel.length > 0 ? buttonLabel : "";
  if (_labelToLookFor.length < 1) return null;
  if (!labelIsCaseSensitive) {
    _labelToLookFor = _labelToLookFor.toLowerCase();
  }

  let _btnLabel = null;
  for (let i = 0; i < _btnDOMArray.length; i++) {
    _btnLabel = null;
    if (
      _btnDOMArray[i] &&
      (_btnDOMArray[i].hasAttribute("aria-label") ||
        _btnDOMArray[i].textContent)
    ) {
      if (_btnDOMArray[i].hasAttribute("aria-label")) {
        _btnLabel = _btnDOMArray[i].getAttribute("aria-label");
        if (!labelIsCaseSensitive && _btnLabel && _btnLabel.length > 0)
          _btnLabel = _btnLabel.toLowerCase();
      }

      if (!_btnLabel || _btnLabel.length < 1) {
        _btnLabel = labelIsCaseSensitive
          ? _btnDOMArray[i].textContent
          : _btnDOMArray[i].textContent.toLowerCase();
      }

      if (_btnLabel.includes(_labelToLookFor)) {
        return _btnDOMArray[i];
      }
    }
  }
  return null;
}

function observeChatMessages() {
  // observe changes to chat tab
  let _tabPanels = document.querySelectorAll('[role="tabpanel"]');
  for (let i = 0; i < _tabPanels.length; i++) {
    let _tab = _tabPanels[i];

    if (
      _tab.querySelector('[role="button"][data-tooltip="Send message"]') &&
      _tab.querySelector('[aria-live="polite"]')
    ) {
      // set id for chat messages element
      let _chatMessagesElm = _tab.querySelector('[aria-live="polite"]');
      if (!_chatMessagesElm.hasAttribute("gme-id")) {
        _chatMessagesElm.setAttribute("gme-id", "gme-chat-messages");

        // observe chat tab
        if (meetingChatObserver) {
          meetingChatObserver.disconnect();
          meetingChatObserver = null;
        }
        meetingChatObserver = new MutationObserver(meetingChatChanged);
        meetingChatObserver.observe(
          document.querySelector('[gme-id="gme-chat-messages"]'),
          {
            attributes: false,
            childList: true,
            subtree: true,
          }
        );
      }
    }
  }
}

function parseMeetingParticipants() {
  let _pJoined = new Map();
  let _pChanged = new Map();
  let _pFound = new Map();
  let _pList = document.querySelector(
    '[role="list"][aria-label="Participants"]'
  );
  if (_pList) {
    let _pListItems = _pList.querySelectorAll('[role="listitem"]');
    for (let i = 0; i < _pListItems.length; i++) {
      let _pListItem = _pListItems[i];
      if (!_pListItem.hasAttribute("data-participant-id")) continue;
      let _pId = extractParticipantId(
        _pListItem.getAttribute("data-participant-id")
      );
      let _pObj = {
        id: _pId,
        isSelf: false,
        name: null,
        pic: null,
        muted: false,
        handRaised: false,
      };
      // get pic
      let _pListItemPic = _pListItem.children[0].querySelector("img");
      if (_pListItemPic && _pListItemPic.hasAttribute("src"))
        _pObj.pic = _pListItemPic.getAttribute("src");
      // get name
      _pObj.name = _pListItem.children[0].textContent;
      if (_pObj.name && _pObj.name.endsWith("(You)")) {
        _pObj.name = _pObj.name.substring(0, _pObj.name.length - 5);
        _pObj.isSelf = true;
        if (!state.meeting.selfParticipantId) {
          state.meeting.selfParticipantId = _pId;
        }
        _pObj.muted = state.meeting.muted;
      }
      if (_pObj.name) _pObj.name = _pObj.name.trim();
      if (!_pObj.isSelf) {
        // get mute status
        _pObj.muted = true;
        let _pListItemBtns = _pListItem.children[1].querySelectorAll(
          '[role="button"][aria-label]'
        );
        for (let j = 0; j < _pListItemBtns.length; j++) {
          if (_pListItemBtns[j].getAttribute("aria-label").includes("Mute")) {
            _pObj.muted = false;
            break;
          }
        }
      }

      _pFound.set(_pId, true);

      // does participant exist already?
      if (!state.meeting.participants.has(_pId)) {
        // nope, just joined
        _pJoined.set(_pId, _pObj);
        state.meeting.participants.set(_pId, _pObj);
      } else {
        // check for changes
        let _pExisting = state.meeting.participants.get(_pId);
        if (
          _pExisting.name !== _pObj.name ||
          _pExisting.muted !== _pObj.muted ||
          _pExisting.pic !== _pObj.pic
        ) {
          _pChanged.set(_pId, true);
          _pExisting.name = _pObj.name;
          _pExisting.muted = _pObj.muted;
          _pExisting.pic = _pObj.pic;
          state.meeting.participants.set(_pId, _pExisting);
        }
      }
    }

    // notify participants left
    for (const [_k, _v] of state.meeting.participants.entries()) {
      if (!_pFound.has(_k)) {
        console.log(_v.name + " left");
        wsSend("participantLeft", _v);
        state.meeting.participants.delete(_k);
      } else if (_pChanged.has(_k)) {
        if (!_v.isSelf) {
          console.log(_v.name + " changed");
          console.log(_v);
          wsSend("participantChanged", _v);
        }
      }
    }

    // notify joined
    for (const [_k, _v] of _pJoined.entries()) {
      if (!_v.isSelf) {
        console.log(_v.name + " joined");
        console.log(_v);
        wsSend("participantJoined", _v);
      }
    }
  }

  _pFound.clear();
  _pList = document.querySelector('[role="list"][aria-label="Raised hands"]');
  if (_pList) {
    let _pListItems = _pList.querySelectorAll('[role="listitem"]');
    for (let i = 0; i < _pListItems.length; i++) {
      if (!_pListItems[i].hasAttribute("data-participant-id")) continue;
      _pFound.set(
        extractParticipantId(
          _pListItems[i].getAttribute("data-participant-id")
        ),
        true
      );
    }
  }
  // notify change of raised hands
  for (let [_k, _v] of state.meeting.participants.entries()) {
    if (_pFound.has(_k)) {
      if (!_v.handRaised) {
        _v.handRaised = true;
        state.meeting.participants.set(_k, _v);
        if (_v.isSelf) {
          state.meeting.handRaised = true;
          wsSend("handRaisedChanged", state.meeting.handRaised);
        } else {
          wsSend("participantChanged", _v);
        }
        console.log(_v.name + " raised hand");
      }
    } else {
      if (_v.handRaised) {
        _v.handRaised = false;
        state.meeting.participants.set(_k, _v);
        if (_v.isSelf) {
          state.meeting.handRaised = false;
          wsSend("handRaisedChanged", state.meeting.handRaised);
        } else {
          wsSend("participantChanged", _v);
        }
        console.log(_v.name + " lowered hand");
      }
    }
  }
}

function resetObservers() {
  if (meetingJoinDisplayStatusObserver) {
    meetingJoinDisplayStatusObserver.disconnect();
    meetingJoinDisplayStatusObserver = null;
  }
  if (meetingChatObserver) {
    meetingChatObserver.disconnect();
    meetingChatObserver = null;
  }
}

function detectPage() {
  var page = "unknown";

  if (document.querySelector('span[aria-label="Quality Dashboard"]')) {
    page = "meetings";
  } else if (document.querySelector("[data-meeting-code]")) {
    if (getJoinButton()) {
      page = "meeting-join-ready";
    } else {
      page = "meeting-join-init";
      let _elm = document.querySelector("[data-meeting-code]");
      if (_elm && _elm.innerText) {
        let _elmInnerTextLower = _elm.innerText.toLowerCase();
        if (_elmInnerTextLower.includes("asking to join...")) {
          page = "meeting-join-asking";
        } else if (_elmInnerTextLower.includes("denied your request to join")) {
          page = "meeting-join-denied";
        }
      }
    }
  } else if (document.querySelector('[data-call-ended="true"]')) {
    let _elm = document.querySelector("[data-user-identifier]")
      .firstElementChild;
    if (_elm && _elm.innerText) {
      let _elmInnerTextLower = _elm.innerText.toLowerCase();
      if (
        _elmInnerTextLower.includes("problem joining") ||
        _elmInnerTextLower.includes("meeting code has expired")
      ) {
        page = "meeting-join-error";
      } else if (_elmInnerTextLower.includes("connection was lost")) {
        page = "meeting-left-error";
      } else if (_elmInnerTextLower.includes("removed from the meeting")) {
        page = "meeting-left-removed";
      } else if (_elmInnerTextLower.includes("you left")) {
        page = "meeting-left";
      } else {
        page = "meeting-left-error";
      }
    }
  } else if (document.querySelector('[aria-label="Leave call"]')) {
    page = "meeting-active";
    let _elm = document.querySelector('[aria-live="assertive"][role="alert"]');
    if (
      _elm &&
      _elm.innerText &&
      _elm.innerText.includes("lost your network connection")
    ) {
      page = "meeting-active-error";
    }
  }

  return page;
}

function updateState() {
  try {
    var _curPage = detectPage();
    var pageChanged = false;
    var pageChangedFrom = null;

    if (_curPage != state.page) {
      if (_curPage === "unknown") {
        // this happens when something's in progress, let the page settle
      } else {
        // page changed
        pageChanged = true;
        pageChangedFrom = state.page;
        state.page = _curPage;
        console.log(
          "page changed from " + pageChangedFrom + " to " + state.page
        );
      }
    }

    if (state.page === "unknown" || _curPage === "unknown") {
      // not sure what's going on, let's jump out and wait
      stateUpdateTimeout = setTimeout(updateState, 1000);
      return;
    }

    if (pageChanged) {
      if (
        state.page.includes("meeting-join-") &&
        state.page !== "meeting-join-error"
      ) {
        // Meeting join page

        // reset joining info
        if (state.page === "meeting-join-init") {
          state.meeting.joining.joinInfo = {
            url: null,
            phone: null,
            pin: null,
          };
        }

        // reset observers
        resetObservers();

        // reset participants and chat messages
        state.meeting.participants.clear();
        state.meeting.chat = [];
        state.dialogs.clear();
        state.meeting.joinRequest = null;

        // get meeting code if haven't gotten already
        let _elmMeetingCode = document
          .querySelector("[data-meeting-code]")
          .getAttribute("data-meeting-code");
        if (
          _elmMeetingCode &&
          _elmMeetingCode.length > 0 &&
          _elmMeetingCode !== state.meeting.id
        ) {
          state.meeting.id = _elmMeetingCode;
          state.meeting.joining.joinInfo = {
            url: "https://meet.google.com/" + state.meeting.id,
            phone: null,
            pin: null,
          };
        }

        // do we need to ask for permission to join meeting?
        state.meeting.joining.needsPermissionToJoin = false;
        state.meeting.joining.canUsePhoneForAudio = false;
        if (state.page === "meeting-join-asking") {
          state.meeting.joining.needsPermissionToJoin = true;
        } else if (state.page === "meeting-join-ready") {
          let _btnJoin = getJoinButton();
          if (_btnJoin.textContent.toLowerCase() === "ask to join") {
            state.meeting.joining.needsPermissionToJoin = true;
          }
        }

        if (state.page === "meeting-join-ready") {
          // Go through all the headings
          let _elmArr = document.querySelectorAll('[role="heading"]');
          for (let i = 0; i < _elmArr.length; i++) {
            let _headingText =
              _elmArr[i] && _elmArr[i].textContent
                ? _elmArr[i].textContent.toLowerCase()
                : "";

            if (_headingText === "other options") {
              if (getButtonContainingLabel(document, "use a phone for audio")) {
                state.meeting.joining.canUsePhoneForAudio = true;
              }
            } else if (
              _headingText === "meeting ready" &&
              !state.meeting.joining.joinInfo.pin
            ) {
              let _elmToCheck = _elmArr[i];
              waitForCondition(
                function () {
                  return (
                    _elmToCheck.parentElement &&
                    _elmToCheck.parentElement.textContent &&
                    _elmToCheck.parentElement.textContent.includes("Dial-in:")
                  );
                },
                function (result) {
                  if (!result) return;

                  let _meetingInfoText =
                    _elmArr[i].parentElement &&
                    _elmArr[i].parentElement.textContent
                      ? _elmArr[i].parentElement.textContent
                      : "";
                  let _meetingPhonePin = extractMeetingJoiningPhonePin(
                    _meetingInfoText
                  );
                  if (_meetingPhonePin.phone) {
                    if (
                      state.meeting.joining.joinInfo.phone !=
                      _meetingPhonePin.phone
                    ) {
                      state.meeting.joining.joinInfo.phone =
                        _meetingPhonePin.phone;
                    }
                    if (
                      state.meeting.joining.joinInfo.pin != _meetingPhonePin.pin
                    ) {
                      state.meeting.joining.joinInfo.pin = _meetingPhonePin.pin;

                      state.meeting.joining.displayStatus =
                        "To join by phone, dial " +
                        state.meeting.joining.joinInfo.phone +
                        " and enter PIN: " +
                        state.meeting.joining.joinInfo.pin;

                      wsSend(
                        "joinByPhoneInfoChanged",
                        state.meeting.joining.joinInfo
                      );

                      wsSend(
                        "joiningDisplayStatusChanged",
                        state.meeting.joining.displayStatus
                      );
                    }
                  }
                },
                10
              );
            } else if (_headingText === "ready to join?") {
              waitForElement(
                '[role="status"][aria-live="polite"]',
                document,
                function (_elmAsked, _elmGot) {
                  if (_elmGot) {
                    // set display status
                    state.meeting.joining.displayStatus = _elmGot.innerText;
                    wsSend(
                      "joiningDisplayStatusChanged",
                      state.meeting.joining.displayStatus
                    );
                    console.log(
                      "meeting current status: " +
                        state.meeting.joining.displayStatus
                    );

                    // and observe for status changes
                    meetingJoinDisplayStatusObserver = new MutationObserver(
                      function (mutationsList, observer) {
                        // status changed?
                        let _elm = document.querySelector(
                          '[role="status"][aria-live="polite"]'
                        );
                        if (
                          _elm &&
                          _elm.innerText &&
                          _elm.innerText !== state.meeting.joining.displayStatus
                        ) {
                          // yup!
                          state.meeting.joining.displayStatus = _elm.innerText;
                          wsSend(
                            "joiningDisplayStatusChanged",
                            state.meeting.joining.displayStatus
                          );
                          console.log(
                            "meeting current status: " +
                              state.meeting.joining.displayStatus
                          );
                        }
                      }
                    );
                    meetingJoinDisplayStatusObserver.observe(
                      document.querySelector(
                        '[role="status"][aria-live="polite"]'
                      ),
                      {
                        attributes: true,
                        childList: true,
                        subtree: true,
                      }
                    );
                  }
                }
              );
            }
          }
        }
      } else if (state.page === "meeting-active") {
        // reset observers
        resetObservers();

        // reset meeting session state
        state.meeting.participants.clear();
        state.meeting.chat = [];
        state.dialogs.clear();
        state.meeting.joinRequest = null;

        // setup observers
        waitForElement(
          '[role="button"][aria-label="Show everyone"]',
          document,
          function (_elmAsked, _elmGot) {
            if (_elmGot) {
              // show the participants sidebar
              _elmGot.click();

              // wait for participants tab to show up
              waitForElement(
                '[role="list"][aria-label="Participants"]',
                document,
                function (_, _) {
                  observeChatMessages();
                },
                5
              );
            } else {
              console.warn("Couldn't find `Show everyone` button");
            }
          },
          20
        );

        // retrieve join by phone info
        if (!state.meeting.joining.joinInfo.phone) {
          waitForElement(
            '[role="dialog"][aria-labelledby]',
            document,
            function (_elmAsked, _elmGot) {
              if (!_elmGot) {
                waitForCondition(
                  function () {
                    return (
                      !getButtonWithLabel(document, "Meeting details") ||
                      !getButtonContainingLabel(document, "Details for ")
                    );
                  },
                  function (result) {
                    if (result) {
                      let _btnMeetingDetails = getButtonWithLabel(
                        document,
                        "Meeting details"
                      );
                      if (!_btnMeetingDetails)
                        _btnMeetingDetails = getButtonContainingLabel(
                          document,
                          "Details for "
                        );
                      _btnMeetingDetails.click();

                      waitForElement(
                        '[role="dialog"][aria-label="Meeting details"]',
                        document,
                        function (_elmAsked2, _elmGot2) {
                          if (_elmGot2) {
                            let _meetingPhonePin = extractMeetingJoiningPhonePin(
                              _elmGot2.textContent
                            );
                            if (
                              !state.meeting.joining.joinInfo.phone &&
                              _meetingPhonePin.phone
                            ) {
                              state.meeting.joining.joinInfo.phone = ret.phone;
                              state.meeting.joining.joinInfo.pin = ret.pin;

                              wsSend(
                                "joinByPhoneInfoChanged",
                                state.meeting.joining.joinInfo
                              );

                              console.log(
                                "To join by phone, dial " +
                                  state.meeting.joining.joinInfo.phone +
                                  " and enter PIN: " +
                                  state.meeting.joining.joinInfo.pin
                              );
                            }

                            // close dialog
                            _btnMeetingDetails.click();
                          }
                        },
                        20
                      );
                    }
                  },
                  20
                );
              }
            },
            5
          );
        }
      } else if (
        state.page === "meeting-join-error" ||
        state.page.includes("meeting-left-")
      ) {
        // reset
        resetObservers();
        state.meeting.participants.clear();
        state.meeting.chat = [];
        state.dialogs.clear();
        state.meeting.joinRequest = null;
      }

      wsSend("pageChanged", {
        from: pageChangedFrom,
        to: state.page,
        state,
      });
    } else {
      // update mute/camera
      let _elmBtns = document.querySelectorAll(
        '[data-is-muted][data-tooltip][role="button"]'
      );
      for (let i = 0; i < _elmBtns.length; i++) {
        if (_elmBtns[i].getAttribute("data-tooltip").includes("microphone")) {
          if (_elmBtns[i].getAttribute("data-is-muted") === "true") {
            if (!state.meeting.muted) {
              state.meeting.muted = true;
              wsSend("muteChanged", state.meeting.muted);
              console.log("Mic muted");
            }
          } else if (state.meeting.muted) {
            state.meeting.muted = false;
            wsSend("muteChanged", state.meeting.muted);
            console.log("Mic unmuted");
          }
        } else if (
          _elmBtns[i].getAttribute("data-tooltip").includes("camera")
        ) {
          if (_elmBtns[i].getAttribute("data-is-muted") === "true") {
            if (state.meeting.cameraOn) {
              state.meeting.cameraOn = false;
              wsSend("cameraChanged", state.meeting.cameraOn);
              console.log("Camera turned off");
            }
          } else if (!state.meeting.cameraOn) {
            state.meeting.cameraOn = true;
            wsSend("cameraChanged", state.meeting.cameraOn);
            console.log("Camera turned on");
          }
        }
      }

      // update captions enabled or not
      _elmBtns = document.querySelectorAll('[role="switch"][aria-checked]');
      for (let i = 0; i < _elmBtns.length; i++) {
        if (_elmBtns[i].innerText.includes("captions")) {
          if (_elmBtns[i].getAttribute("aria-checked") === "true") {
            if (!state.meeting.captionsEnabled) {
              state.meeting.captionsEnabled = true;
              wsSend("captionsChanged", state.meeting.captionsEnabled);
              console.log("Turned on captions");
            }
          } else if (state.meeting.captionsEnabled) {
            state.meeting.captionsEnabled = false;
            wsSend("captionsChanged", state.meeting.captionsEnabled);
            console.log("Turned off captions");
          }
          break;
        }
      }

      // get dialogs
      let _dFound = new Map();
      let _dFoundJoinRequest = false;
      let _elmDialogs = document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"]'
      );
      for (let i = 0; i < _elmDialogs.length; i++) {
        let _dialog = _elmDialogs[i];
        if (!_dialog) continue;
        let _dialogTitle = null;
        if (_dialog.hasAttribute("aria-label"))
          _dialogTitle = _dialog.getAttribute("aria-label");
        if (!_dialogTitle && _dialog.hasAttribute("aria-labelledby")) {
          _dialogTitle = document.querySelector(
            '[id="' + _dialog.getAttribute("aria-labelledby") + '"]'
          )
            ? document.querySelector(
                '[id="' + _dialog.getAttribute("aria-labelledby") + '"]'
              ).textContent
            : null;
        }
        if (!_dialogTitle && _dialog.hasAttribute("aria-describedby")) {
          _dialogTitle = document.querySelector(
            '[id="' + _dialog.getAttribute("aria-describedby") + '"]'
          )
            ? document.querySelector(
                '[id="' + _dialog.getAttribute("aria-describedby") + '"]'
              ).textContent
            : null;
        }
        if (!_dialogTitle) {
          _dialogTitle = _dialog.innerText;
          if (_dialogTitle && _dialogTitle.includes("\n")) {
            _dialogTitle = _dialogTitle.substring(
              0,
              _dialogTitle.indexOf("\n")
            );
          }
        }
        if (!_dialogTitle) continue;
        _dialogTitle = _dialogTitle.trim();

        // is it a join request dialog?
        if (
          _dialogTitle.includes("One or more people want to join this call")
        ) {
          _dFoundJoinRequest = true;
          let _dialogExists = state.meeting.joinRequest !== null;
          let _dialogModified = false;
          let _viewAllBtn = null;
          let _dialogBtns = _dialog.querySelectorAll(
            '[role="button"][aria-disabled="false"]'
          );
          for (let j = 0; j < _dialogBtns.length; j++) {
            if (_dialogBtns[j].textContent.includes("View all")) {
              _viewAllBtn = _dialogBtns[j];
              break;
            }
          }

          if (_viewAllBtn) {
            _viewAllBtn.click();
            continue;
          }

          let _jrList = [];
          if (
            _dialog.textContent.includes(
              "Multiple people want to join this call"
            )
          ) {
            let _rqListElm = null;
            for (let j = 0; j < _dialog.children.length; j++) {
              if (_dialog.children[j].textContent.includes("Deny entry")) {
                // this element contains list of requesters
                if (
                  _dialog.children[j].firstElementChild &&
                  _dialog.children[j].firstElementChild.firstElementChild
                ) {
                  _rqListElm =
                    _dialog.children[j].firstElementChild.firstElementChild;
                  break;
                }
              }
            }

            for (let j = 0; _rqListElm && j < _rqListElm.children.length; j++) {
              let _rqName = _rqListElm.children[j].querySelector("div")
                ? _rqListElm.children[j].querySelector("div").innerText
                : null;
              if (_rqName) {
                _rqName = _rqName.replace("\n", " ");
                _rqName = _rqName.trim();
              }
              if (_rqName && _rqName.length > 0) _jrList.push(_rqName);
            }
          } else {
            let _dialogTextLines = _dialog.innerText.trim().split("\n");
            if (
              _dialogTextLines.length > 1 &&
              _dialogTextLines[0].includes("Someone wants to join this call")
            ) {
              _jrList.push(_dialogTextLines[1].trim());
            }
          }

          if (_jrList.length === 0) continue;

          if (_dialogExists) {
            if (
              state.meeting.joinRequest &&
              state.meeting.joinRequest.length !== _jrList.length
            ) {
              _dialogModified = true;
            } else {
              // item by item comparison
              for (let j = 0; j < _jrList.length; j++) {
                if (_jrList[j] !== state.meeting.joinRequest[j]) {
                  _dialogModified = true;
                  break;
                }
              }
            }
          }

          if (_dialogModified) {
            state.meeting.joinRequest = _jrList;
            wsSend("meetingJoinRequestChanged", state.meeting.joinRequest);
            console.log("updated - want to join meeting:");
            console.log(state.meeting.joinRequest);
          } else if (!_dialogExists) {
            state.meeting.joinRequest = _jrList;
            wsSend("meetingJoinRequest", state.meeting.joinRequest);
            console.log("want to join meeting:");
            console.log(state.meeting.joinRequest);
          }

          // move on to next dialog (if any)
          continue;
        }

        _dFound.set(_dialogTitle, true);
        if (state.dialogs.has(_dialogTitle)) {
          continue;
        } else {
          let _dialogCloseBtn = null;
          if (_dialogTitle === "Meeting details") {
            _dialogCloseBtn = document.querySelector(
              '[role="button"][aria-label="Meeting details"]'
            );
            if (!_dialogCloseBtn) {
              _dialogCloseBtn = getButtonContainingLabel(
                document,
                "Details for "
              );
            }
          } else {
            _dialogCloseBtn = _dialog.querySelector(
              '[role="button"][aria-label="Close"]'
            );
            if (!_dialogCloseBtn) {
              let _elmDialogBtns = _dialog.querySelectorAll('[role="button"]');
              for (let k = 0; k < _elmDialogBtns.length; k++) {
                if (
                  _elmDialogBtns[k].textContent.includes("Close") ||
                  _elmDialogBtns[k].textContent.includes("Dismiss")
                ) {
                  _dialogCloseBtn = _elmDialogBtns[k];
                  break;
                }
              }
            }
          }

          state.dialogs.set(_dialogTitle, {
            title: _dialogTitle,
            text: _dialog.innerText,
            closeButton: _dialogCloseBtn,
          });

          // notify dialog shown
          wsSend("dialogShown", state.dialogs.get(_dialogTitle));
          console.log("Dialog shown: " + _dialogTitle);

          // grab meeting joining info from "Add others" dialog
          if (
            _dialogTitle === "Add others" &&
            !state.meeting.joining.joinInfo.phone
          ) {
            let _meetingPhonePin = extractMeetingJoiningPhonePin(
              _dialog.textContent
            );
            if (_meetingPhonePin.phone) {
              state.meeting.joining.joinInfo.phone = _meetingPhonePin.phone;
              state.meeting.joining.joinInfo.pin = _meetingPhonePin.pin;

              wsSend("joinByPhoneInfoChanged", state.meeting.joining.joinInfo);

              console.log(
                "To join by phone, dial " +
                  state.meeting.joining.joinInfo.phone +
                  " and enter PIN: " +
                  state.meeting.joining.joinInfo.pin
              );
            }
          }
        }
      }

      // notify dialog closed
      for (const [_k, _v] of state.dialogs) {
        if (!_dFound.has(_k)) {
          // dialog closed
          wsSend("dialogClosed", _v);
          state.dialogs.delete(_k);
          console.log("Dialog closed: " + _v.title);
        }
      }

      // no join requests?
      if (!_dFoundJoinRequest && state.meeting.joinRequest) {
        state.meeting.joinRequest = null;
        wsSend("meetingJoinRequestClosed", state.meeting.joinRequest);
        console.log("No more join requests");
      }

      if (state.page === "meeting-active") {
        // update participants
        parseMeetingParticipants();

        // check for changes in tiled on display
        if (!state.meeting.selfTiled) {
          if (
            document.querySelector('[role="button"][aria-label="Remove tile"]')
          ) {
            state.meeting.selfTiled = true;
            wsSend("tiledChanged", self.meeting.selfTiled);
            console.log("we are now tiled in the display");
          }
        } else if (
          document.querySelector('[role="button"][aria-label="Show in a tile"]')
        ) {
          state.meeting.selfTiled = false;
          wsSend("tiledChanged", self.meeting.selfTiled);
          console.log("we are no longer tiled in the display");
        }

        // check for who's pinned to screen
        let _pinnedBtn = document.querySelector(
          '[role="button"][data-tooltip="Unpin"]'
        );
        let _pinnedId = null;
        if (_pinnedBtn && _pinnedBtn.parentElement) {
          let _parentElm = _pinnedBtn.parentElement;
          while (_parentElm) {
            if (_parentElm.hasAttribute("data-participant-id")) {
              let _pIdFound = _parentElm.getAttribute("data-participant-id");
              if (_pIdFound && _pIdFound.length > 1) {
                let _pIdExtracted = extractParticipantId(_pIdFound);
                if (_pIdExtracted && _pIdExtracted.length > 0) {
                  _pinnedId = _pIdExtracted;
                  break;
                }
              }
            }
            if (_parentElm.hasAttribute("data-requested-participant-id")) {
              let _pIdFound = _parentElm.getAttribute(
                "data-requested-participant-id"
              );
              if (_pIdFound && _pIdFound.length > 1) {
                let _pIdExtracted = extractParticipantId(_pIdFound);
                if (_pIdExtracted && _pIdExtracted.length > 0) {
                  _pinnedId = _pIdExtracted;
                  break;
                }
              }
            }
            _parentElm = _parentElm.parentElement;
          }
        }
        if (_pinnedId) {
          if (state.meeting.participantPinned !== _pinnedId) {
            if (state.meeting.participantPinned) {
              wsSend("unpinned", state.meeting.participantPinned);
              console.log(
                "Unpinned Participant: " + state.meeting.participantPinned
              );
            }
            state.meeting.participantPinned = _pinnedId;
            wsSend("pinned", state.meeting.participantPinned);
            console.log("Pinned Participant: " + _pinnedId);
          }
        } else {
          if (state.meeting.participantPinned) {
            let _lastPinnedParticipantId = state.meeting.participantPinned;
            state.meeting.participantPinned = null;
            wsSend("unpinned", _lastPinnedParticipantId);
            console.log("Unpinned Participant: " + _lastPinnedParticipantId);
          }
        }

        // check if subscribed to chat messages
        if (!document.querySelector('[gme-id="gme-chat-messages"]')) {
          observeChatMessages();
        }
      } else if (state.page === "meetings") {
        // check for scheduled meetings
        let _mFound = new Map();
        let _elmBtns = document.querySelectorAll('[role="button"]');
        for (let i = 0; i < _elmBtns.length; i++) {
          if (
            _elmBtns[i] &&
            _elmBtns[i].textContent &&
            _elmBtns[i].textContent.includes("Join or start a meeting")
          ) {
            let _elmMeetings = _elmBtns[i].nextElementSibling;
            while (_elmMeetings) {
              if (
                _elmMeetings.childElementCount > 0 &&
                _elmMeetings.querySelector("c-wiz")
              ) {
                break;
              }
              _elmMeetings = _elmMeetings.nextElementSibling;
            }
            if (_elmMeetings) {
              let _mList = _elmMeetings.querySelectorAll("c-wiz");
              for (let j = 0; j < _mList.length; j++) {
                let _mId = null;
                let _mObj = {
                  id: null,
                  name: null,
                  beginTime: null,
                  endTime: null,
                };
                let _mBtn = _mList[j].querySelector(
                  '[role="button"][data-call-id]'
                );
                if (_mBtn) {
                  _mId = _mBtn.getAttribute("data-call-id");
                  if (!_mId || _mId.length < 1) continue;
                  _mObj.id = _mId;
                  _mFound.set(_mId, true);

                  _mObj.name =
                    _mBtn.children.length > 1 && _mBtn.children[1].textContent
                      ? _mBtn.children[1].textContent.trim()
                      : "";

                  _mObj.beginTime = _mBtn.hasAttribute("data-begin-time")
                    ? parseFloat(_mBtn.getAttribute("data-begin-time"))
                    : mBtn.firstElementChild &&
                      _mBtn.firstElementChild.textContent
                    ? getTimestampFromDate(
                        _mBtn.firstElementChild.textContent.trim()
                      )
                    : null;

                  _mObj.endTime = _mBtn.hasAttribute("data-end-time")
                    ? parseFloat(_mBtn.getAttribute("data-end-time"))
                    : null;

                  if (state.meetingsToday.has(_mId)) {
                    // update existing
                    let _existingMeeting = state.meetingsToday.get(_mId);
                    if (
                      _existingMeeting.name !== _mObj.name ||
                      _existingMeeting.beginTime !== _mObj.beginTime ||
                      _existingMeeting.endTime !== _mObj.endTime
                    ) {
                      state.meetingsToday.set(_mId, _mObj);
                      wsSend("scheduledMeetingChanged", _mObj);
                      console.log("meeting updated:");
                      console.log(
                        "meeting id: " +
                          _mId +
                          "\nname: " +
                          _mObj.name +
                          "\nbegin-time: " +
                          getDateFromTimestamp(_mObj.beginTime) +
                          "\nend-time: " +
                          getDateFromTimestamp(_mObj.endTime)
                      );
                    }
                  } else {
                    // new meeting
                    state.meetingsToday.set(_mId, _mObj);

                    wsSend("scheduledMeeting", _mObj);

                    console.log("new meeting:");
                    console.log(
                      "meeting id: " +
                        _mId +
                        "\nname: " +
                        _mObj.name +
                        "\nbegin-time: " +
                        getDateFromTimestamp(_mObj.beginTime) +
                        "\nend-time: " +
                        getDateFromTimestamp(_mObj.endTime)
                    );
                  }
                }
              }

              for (let [_k, _v] of state.meetingsToday) {
                if (!_mFound.has(_k)) {
                  // meeting done/removed
                  wsSend("scheduledMeetingRemoved", _v);
                  console.log("meeting done/removed:");
                  console.log(
                    "meeting id: " +
                      _k +
                      "\nname: " +
                      _v.name +
                      "\nbegin-time: " +
                      getDateFromTimestamp(_v.beginTime) +
                      "\nend-time: " +
                      getDateFromTimestamp(_v.endTime)
                  );
                  state.meetingsToday.delete(_k);
                }
              }
            }

            break;
          }
        }
      }
    }
  } catch (err) {
    console.error(err.message);
  }

  stateUpdateTimeout = setTimeout(updateState, 1000);
}

function meetingChatChanged(mutationsList, observer) {
  for (let i = 0; i < mutationsList.length; i++) {
    if (mutationsList[i].removedNodes.length > 0) return;
  }

  for (let i = 0; i < mutationsList.length; i++) {
    if (mutationsList[i].addedNodes.length < 1) continue;

    for (let j = 0; j < mutationsList[i].addedNodes.length; j++) {
      let _msg = mutationsList[i].addedNodes[j];
      let _msgObj = {
        senderId: null,
        senderName: null,
        timestamp: null,
        message: null,
      };

      if (_msg.hasAttribute("data-sender-id")) {
        _msgObj.senderId = extractParticipantId(
          _msg.getAttribute("data-sender-id")
        );
        if (_msg.hasAttribute("data-sender-name")) {
          _msgObj.senderName = _msg.getAttribute("data-sender-name");
        }
        if (_msg.hasAttribute("data-timestamp")) {
          _msgObj.timestamp = isNumeric(_msg.getAttribute("data-timestamp"))
            ? parseFloat(_msg.getAttribute("data-timestamp"))
            : null;
        }
      } else if (state.meeting.chat.length > 0) {
        let _lastMsgObj = state.meeting.chat[state.meeting.chat.length - 1];
        _msgObj.senderId = _lastMsgObj.senderId;
        _msgObj.senderName = _lastMsgObj.senderName;
        _msgObj.timestamp = _lastMsgObj.timestamp;
      }

      if (_msg.hasAttribute("data-message-text")) {
        _msgObj.message = _msg.innerText ? _msg.innerText.trim() : "";
      } else if (_msg.children.length > 1) {
        _msgObj.message = _msg.children[1].innerText
          ? _msg.children[1].innerText.trim()
          : "";
      }
      state.meeting.chat.push(_msgObj);
      wsSend("chatMessage", _msgObj);
      console.log(_msgObj);
    }
  }
}

function websocketClientConnect() {
  if (wsConnectTimeout) {
    clearTimeout(wsConnectTimeout);
    wsConnectTimeout = null;
  }

  if (!wsClient || wsClient.readyState == 3) {
    wsClient = null;

    if (serverPath) {
      wsClient = new WebSocket(serverPath);

      wsClient.onopen = function (e) {
        wsIsConnected = true;
        console.log("Connection established");
        console.log("Sending full state to server");
        wsSend("connected", {
          type: "extension",
          id: state.tabId,
        });
        wsSend("state", state);
      };

      wsClient.onmessage = websocketClientMessageReceived;

      wsClient.onclose = function (event) {
        if (event.wasClean) {
          console.log(
            "[close] Connection closed cleanly, code=" +
              event.code +
              " reason=" +
              event.reason
          );
        } else {
          // e.g. server process killed or network down
          // event.code is usually 1006 in this case
          if (wsIsConnected) {
            console.warn("[close] Connection died", event);
          }
        }

        wsIsConnected = false;
        wsClient = null;
      };

      wsClient.onerror = function (error) {
        if (wsIsConnected) {
          console.error("WebSocket error observed:", error);
        }
      };
    }
  }

  if (!wsConnectTimeout) {
    wsConnectTimeout = setTimeout(websocketClientConnect, 10000);
  }
}

function websocketClientMessageReceived(event) {
  let _message = JSON.parse(event.data);
  if (_message.action) {
    try {
      let _func = eval(_message.action);
      if (_message.args) {
        if (!Array.isArray(_message.args)) {
          _func(_message.args);
        } else {
          if (_message.args.length == 1) {
            _func(_message.args[0]);
          } else if (_message.args.length == 2) {
            _func(_message.args[0], _message.args[1]);
          } else if (_message.args.length == 3) {
            _func(_message.args[0], _message.args[1], _message.args[2]);
          } else if (_message.args.length == 4) {
            _func(
              _message.args[0],
              _message.args[1],
              _message.args[2],
              _message.args[3]
            );
          }
        }
      } else {
        _func();
      }
    } catch (err) {
      // ignore
    }
  }
}

function wsSend(subject, message = null) {
  if (!subject || !wsIsConnected) return;

  wsClient.send(
    JSON.stringify({
      sender: state.tabId,
      subject: subject,
      message: message,
    })
  );
}

function checkReadyState() {
  if (document.readyState === "complete") {
    console.log("Hello. Thanks for installing Google Meet Websockets!");

    websocketClientConnect();

    stateUpdateTimeout = setTimeout(updateState, 500);

    // debug
    var debugDiv = document.createElement("div");
    debugDiv.style.cssText = "display: none";
    debugDiv.setAttribute("id", "gme-debug-div");
    document.body.appendChild(debugDiv);
    var debugObserver = new MutationObserver(function (mutations) {
      let _debugDiv = document.getElementById("gme-debug-div");
      let _debugCmd = null;
      if (
        _debugDiv &&
        _debugDiv.textContent &&
        _debugDiv.textContent.length > 2
      ) {
        _debugCmd = _debugDiv.textContent;
        _debugDiv.innerHTML = "";
        eval(_debugCmd);
      }
    });
    debugObserver.observe(debugDiv, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    // END debug
  } else {
    setTimeout(checkReadyState, 100);
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!sender.tab) {
    // message from background.js
    if (message == "notifyOptionsUpdated") {
      // get updated websocket server to connect to
      chrome.storage.local.get(
        {
          serverPath: null,
        },
        function (items) {
          if (items.serverPath && items.serverPath !== serverPath) {
            serverPath = items.serverPath;
            console.log("connecting to server: " + serverPath);
            if (wsIsConnected) {
              wsClient.close();
              if (wsConnectTimeout) {
                clearTimeout(wsConnectTimeout);
                wsConnectTimeout = setTimeout(websocketClientConnect, 1000);
              }
            }
          }
        }
      );
    }
  }
});

chrome.runtime.sendMessage("getTabId", function (response) {
  if (response) {
    state.tabId = response;
  }
});

// get websocket server to connect to
chrome.storage.local.get(
  {
    serverPath: null,
  },
  function (items) {
    if (items.serverPath) {
      serverPath = items.serverPath;
      console.log("connecting to server: " + serverPath);
    }
  }
);

readyStateCheckTimeout = setTimeout(checkReadyState, 100);

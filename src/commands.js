function commandJoinCall() {
  if (state.page !== "meeting-join-ready") return;

  let _joinCallBtn = getJoinButton();
  if (_joinCallBtn) _joinCallBtn.click();
}

function commandLeaveCall() {
  if (state.page !== "meeting-active") return;

  let _leaveCallBtn = document.querySelector(
    '[role="button"][aria-label="Leave call"]'
  );
  if (_leaveCallBtn) _leaveCallBtn.click();
}

function commandToggleMute() {
  let _elmBtns = document.querySelectorAll(
    '[data-is-muted][data-tooltip][role="button"]'
  );

  if (!_elmBtns || _elmBtns.length < 1) return;

  for (let i = 0; i < _elmBtns.length; i++) {
    if (_elmBtns[i].getAttribute("data-tooltip").includes("microphone")) {
      _elmBtns[i].click();
      return;
    }
  }
}

function commandMute() {
  if (!state.meeting.muted) {
    commandToggleMute();
  }
}

function commandUnmute() {
  if (state.meeting.muted) {
    commandToggleMute();
  }
}

function commandToggleCamera() {
  let _elmBtns = document.querySelectorAll(
    '[data-is-muted][data-tooltip][role="button"]'
  );

  if (!_elmBtns || _elmBtns.length < 1) return;

  for (let i = 0; i < _elmBtns.length; i++) {
    if (_elmBtns[i].getAttribute("data-tooltip").includes("camera")) {
      _elmBtns[i].click();
      return;
    }
  }
}

function commandTurnOnCamera() {
  if (!state.meeting.cameraOn) {
    commandToggleCamera();
  }
}

function commandTurnOffCamera() {
  if (state.meeting.cameraOn) {
    commandToggleCamera();
  }
}

function commandToggleRaiseHand() {
  if (state.page !== "meeting-active") return;

  let _btn = document.querySelector('[role="button"][aria-label="Raise hand"]');
  if (_btn) {
    _btn.click();
  } else {
    _btn = document.querySelector('[role="button"][aria-label="Lower hand"]');
    if (_btn) _btn.click();
  }
}

function commandRaiseHand() {
  if (!state.meeting.handRaised) {
    commandToggleRaiseHand();
  }
}

function commandLowerHand() {
  if (state.meeting.handRaised) {
    commandToggleRaiseHand();
  }
}

function commandToggleCaptions() {
  if (state.page !== "meeting-active") return;

  let _switches = document.querySelectorAll('[role="switch"]');
  for (let i = 0; i < _switches.length; i++) {
    if (_switches[i].textContent.includes("captions")) {
      let _btn = _switches[i].querySelector('[role="button"]');
      if (_btn) _btn.click();
      return;
    }
  }
}

function commandTurnOnCaptions() {
  if (!state.meeting.captionsEnabled) {
    commandToggleCaptions();
  }
}

function commandTurnOffCaptions() {
  if (state.meeting.captionsEnabled) {
    commandToggleCaptions();
  }
}

function commandCallNumber(number) {
  if (!number || number.length < 2) return;

  if (state.page === "meeting-active") {
    let _elms = document.querySelectorAll(
      '[role="button"][aria-disabled="false"]'
    );
    for (let i = 0; i < _elms.length; i++) {
      if (_elms[i].textContent.includes("Add people")) {
        _elms[i].click();
        waitForElement(
          '[role="tab"][aria-label="Call"]',
          document,
          function (_elmAsked, _elmGot) {
            if (_elmGot) {
              _elmGot.click();
              waitForElement(
                'input[type="tel"][aria-label="Enter a phone number"]',
                document,
                function (_elmAsked2, _elmGot2) {
                  if (_elmGot2) {
                    _elmGot2.value = number;
                    _elmGot2.dispatchEvent(
                      new Event("input", { bubbles: true })
                    );
                    waitForCondition(
                      function () {
                        let __elm = document.querySelector(
                          '[role="button"][data-tooltip="Call"]'
                        );
                        return (
                          !__elm.hasAttribute("aria-disabled") ||
                          (__elm.hasAttribute("aria-disabled") &&
                            __elm.getAttribute("aria-disabled") == "false")
                        );
                      },
                      function (result) {
                        if (result) {
                          document
                            .querySelector(
                              '[role="button"][data-tooltip="Call"]'
                            )
                            .click();
                          waitForCondition(
                            function () {
                              if (
                                !document.querySelector(
                                  '[role="dialog"][data-participant-id]'
                                )
                              )
                                return false;
                              if (
                                !document
                                  .querySelector(
                                    '[role="dialog"][data-participant-id]'
                                  )
                                  .querySelector(
                                    '[role="button"][aria-label="Close"]'
                                  )
                              )
                                return false;
                              return true;
                            },
                            function (result) {
                              if (result) {
                                document
                                  .querySelector(
                                    '[role="dialog"][data-participant-id]'
                                  )
                                  .querySelector(
                                    '[role="button"][aria-label="Close"]'
                                  )
                                  .click();
                              }
                            },
                            200
                          );
                        }
                      },
                      10
                    );
                  }
                },
                10
              );
            }
          },
          10
        );
        break;
      }
    }
  }
}

function commandSendChatMessage(message) {
  if (!message || message.length < 1) return;
  if (state.page !== "meeting-active") return;

  let _textBox = document.querySelector(
    'textarea[aria-label="Send a message to everyone"]'
  );
  let _sendBtn = document.querySelector(
    '[role="button"][data-tooltip="Send message"]'
  );
  if (!_textBox || !_sendBtn) return;

  _textBox.value = message;
  _textBox.dispatchEvent(new Event("input", { bubbles: true }));

  waitForCondition(
    function () {
      return (
        !_sendBtn.hasAttribute("aria-disabled") ||
        (_sendBtn.hasAttribute("aria-disabled") &&
          _sendBtn.getAttribute("aria-disabled") == "false")
      );
    },
    function (result) {
      if (result) _sendBtn.click();
    },
    10
  );
}

function _joinRequestAdmitDeny(action = "admit", requesterIndex = -1) {
  if (state.page !== "meeting-active" || !state.meeting.joinRequest) return;

  let _dialog = document.querySelector(
    '[role="dialog"][aria-label="One or more people want to join this call"]'
  );
  if (!_dialog) return;

  let _btnLabelSingle = "Admit";
  let _btnLabelMultiple = "Admit all";
  if (action === "deny") {
    _btnLabelSingle = "Deny entry";
    _btnLabelMultiple = "Deny all";
  }

  if (
    !isNumeric(requesterIndex) ||
    requesterIndex < 0 ||
    (requesterIndex === 0 &&
      state.meeting.joinRequest &&
      state.meeting.joinRequest.length === 1)
  ) {
    let _elmBtns = _dialog.querySelectorAll(
      '[role="button"][aria-disabled="false"]'
    );
    for (let i = 0; i < _elmBtns.length; i++) {
      if (_elmBtns[i] && _elmBtns[i].textContent.includes(_btnLabelMultiple)) {
        _elmBtns[i].click();
        return;
      }
    }
    // didn't find the Admin/Deny all button, look for Admit/Deny entry button instead
    for (let i = 0; i < _elmBtns.length; i++) {
      if (_elmBtns[i] && _elmBtns[i].textContent.includes(_btnLabelSingle)) {
        _elmBtns[i].click();
        return;
      }
    }
  } else if (
    _dialog.textContent.includes("Multiple people want to join this call")
  ) {
    let _rqListElm = null;
    for (let i = 0; i < _dialog.children.length; i++) {
      if (_dialog.children[i].textContent.includes("Deny entry")) {
        // this element contains list of requesters
        if (
          _dialog.children[i].firstElementChild &&
          _dialog.children[i].firstElementChild.firstElementChild
        ) {
          _rqListElm = _dialog.children[i].firstElementChild.firstElementChild;
          break;
        }
      }
    }
    if (
      !_rqListElm ||
      !_rqListElm.children ||
      _rqListElm.children.length < requesterIndex + 1
    )
      return;

    let _elmBtns = _rqListElm.children[requesterIndex].querySelectorAll(
      '[role="button"]'
    );
    for (let i = 0; i < _elmBtns.length; i++) {
      if (_elmBtns[i] && _elmBtns[i].textContent.includes(_btnLabelSingle)) {
        _elmBtns[i].click();
        return;
      }
    }
  }
}

function commandAdmit(requesterIndex = -1) {
  _joinRequestAdmitDeny("admit", requesterIndex);
}

function commandAdmitAll() {
  _joinRequestAdmitDeny("admit");
}

function commandDeny(requesterIndex = -1) {
  _joinRequestAdmitDeny("deny", requesterIndex);
}

function commandDenyAll() {
  _joinRequestAdmitDeny("deny");
}

function commandToggleTile() {
  if (state.page !== "meeting-active") return;

  let _elmBtn = document.querySelector(
    '[role="button"][aria-label="Show in a tile"][aria-disabled="false"]'
  );
  if (_elmBtn) {
    _elmBtn.click();
  } else {
    _elmBtn = document.querySelector(
      '[role="button"][aria-label="Remove tile"][aria-disabled="false"]'
    );
    if (_elmBtn) {
      _elmBtn.click();
    }
  }
}

function commandTileOn() {
  if (state.page !== "meeting-active" || state.meeting.selfTiled) return;
  commandToggleTile();
}

function commandTileOff() {
  if (state.page !== "meeting-active" || !state.meeting.selfTiled) return;
  commandToggleTile();
}

function _findParticipantElementById(participantId) {
  if (
    state.page !== "meeting-active" ||
    !participantId ||
    participantId.length < 1
  )
    return;

  let _pList = document.querySelector(
    '[role="list"][aria-label="Participants"]'
  );
  if (!_pList) return;
  let _pListItems = _pList.querySelectorAll('[role="listitem"]');
  let _pId = null;
  for (let i = 0; i < _pListItems.length; i++) {
    if (!_pListItems[i].hasAttribute("data-participant-id")) continue;
    _pId = extractParticipantId(
      _pListItems[i].getAttribute("data-participant-id")
    );
    if (_pId === participantId) {
      return _pListItems[i];
    }
  }
  return null;
}

function commandMuteParticipant(participantId) {
  if (
    state.page !== "meeting-active" ||
    !participantId ||
    participantId.length < 1
  )
    return;

  if (participantId === state.meeting.selfParticipantId) {
    commandMute();
    return;
  }

  // close dialog if any
  for (let _k of state.dialogs.keys()) {
    commandCloseDialog(_k);
  }

  // get participant html element
  let _pElem = _findParticipantElementById(participantId);
  if (!_pElem || !_pElem.children || _pElem.children.length < 2) return;

  // find mute button
  let _pListItemBtns = _pElem.children[1].querySelectorAll(
    '[role="button"][aria-label]'
  );
  for (let j = 0; j < _pListItemBtns.length; j++) {
    if (_pListItemBtns[j].getAttribute("aria-label").includes("Mute")) {
      // found, now click it
      _pListItemBtns[j].click();
      // now, wait for alert dialog, click `Mute` again
      waitForElement(
        '[role="alertdialog"]',
        document,
        function (_elmAsked, _elmGot) {
          if (_elmGot) {
            let _alertDialogs = document.querySelectorAll(
              '[role="alertdialog"]'
            );
            let _elmBtns = null;
            let k = 0;
            let l = 0;
            let _found = false;
            for (k = 0; k < _alertDialogs.length; k++) {
              if (_alertDialogs[k].textContent.includes("Mute ")) {
                _elmBtns = _alertDialogs[k].querySelectorAll('[role="button"]');
                for (l = 0; l < _elmBtns.length; l++) {
                  if (_elmBtns[l].textContent.includes("Mute")) {
                    _elmBtns[l].click();
                    _found = true;
                    break;
                  }
                }
              }
              if (_found) break;
            }
          }
        },
        10
      );
      break;
    }
  }
}

function _findDialogElement(dialogTitle = null) {
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
        _dialogTitle = _dialogTitle.substring(0, _dialogTitle.indexOf("\n"));
      }
    }
    if (dialogTitle) {
      if (!_dialogTitle) continue;
      if (dialogTitle !== _dialogTitle) continue;
    }

    return _dialog;
  }

  return null;
}

function commandPinToScreen(participantId = null) {
  if (state.page !== "meeting-active") return;

  let _pId = participantId;
  if (!_pId) _pId = state.meeting.selfParticipantId;

  if (_pId === state.meeting.selfParticipantId) {
    let _pinBtn = document.querySelector(
      '[role="button"][aria-label="Pin yourself to your main screen."]'
    );
    if (_pinBtn) {
      _pinBtn.click();
    }
  } else {
    // close dialog if any
    for (let _k of state.dialogs.keys()) {
      commandCloseDialog(_k);
    }

    // get participant html element
    let _pElem = _findParticipantElementById(_pId);
    if (!_pElem) return;

    // find more actions button
    let _moreActionsBtn = _pElem.querySelector(
      '[role="button"][data-tooltip="More actions"]'
    );
    if (_moreActionsBtn) {
      _moreActionsBtn.click();
      waitForElement(
        '[role="menu"]',
        document,
        function (_elmAsked, _elmGot) {
          if (_elmGot) {
            let _elmMenuItems = _elmGot.querySelectorAll('[role="menuitem"]');
            for (let i = 0; i < _elmMenuItems.length; i++) {
              if (_elmMenuItems[i].textContent.includes("Pin to screen")) {
                _elmMenuItems[i].click();
                setTimeout(function () {
                  // simulate mouse events
                  _elmMenuItems[i].dispatchEvent(
                    new MouseEvent("mousedown", {
                      view: window,
                      bubbles: true,
                      cancelable: true,
                    })
                  );
                  setTimeout(function () {
                    _elmMenuItems[i].dispatchEvent(
                      new MouseEvent("mouseup", {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                      })
                    );
                  }, 1000);
                }, 1000);

                break;
              }
            }
          }
        },
        10
      );
    }
  }
}

function commandUnpin() {
  if (state.page !== "meeting-active") return;

  let _unpinBtn = document.querySelector(
    '[role="button"][data-tooltip="Unpin"]'
  );
  if (_unpinBtn) {
    _unpinBtn.click();
  }
}

function commandRemoveFromMeeting(participantId) {
  if (
    state.page !== "meeting-active" ||
    !participantId ||
    participantId.length < 1 ||
    participantId === state.meeting.selfParticipantId
  )
    return;

  // close dialog if any
  for (let _k of state.dialogs.keys()) {
    commandCloseDialog(_k);
  }

  // get participant html element
  let _pElem = _findParticipantElementById(participantId);
  if (!_pElem) return;

  // find more actions button
  let _moreActionsBtn = _pElem.querySelector(
    '[role="button"][data-tooltip="More actions"]'
  );
  if (_moreActionsBtn) {
    _moreActionsBtn.click();
    waitForElement(
      '[role="menu"]',
      document,
      function (_elmAsked, _elmGot) {
        if (_elmGot) {
          let _elmMenuItems = _elmGot.querySelectorAll('[role="menuitem"]');
          for (let i = 0; i < _elmMenuItems.length; i++) {
            if (_elmMenuItems[i].textContent.includes("Remove from meeting")) {
              _elmMenuItems[i].click();
              setTimeout(function () {
                // simulate mouse events
                _elmMenuItems[i].dispatchEvent(
                  new MouseEvent("mousedown", {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                  })
                );
                setTimeout(function () {
                  _elmMenuItems[i].dispatchEvent(
                    new MouseEvent("mouseup", {
                      view: window,
                      bubbles: true,
                      cancelable: true,
                    })
                  );

                  // wait for dialog, then click `Remove` button
                  waitForCondition(
                    function () {
                      let _dialogs = document.querySelectorAll(
                        '[role="dialog"]'
                      );
                      for (let j = 0; j < _dialogs.length; j++) {
                        if (
                          _dialogs[j].querySelector(
                            '[role="button"][aria-label="Remove"]'
                          )
                        ) {
                          return true;
                        }
                      }
                      return false;
                    },
                    function (result) {
                      if (result) {
                        let _dialogs = document.querySelectorAll(
                          '[role="dialog"]'
                        );
                        let _elmBtn = null;
                        for (let j = 0; j < _dialogs.length; j++) {
                          _elmBtn = _dialogs[j].querySelector(
                            '[role="button"][aria-label="Remove"]'
                          );
                          if (_elmBtn) {
                            _elmBtn.click();
                          }
                        }
                      }
                    },
                    10
                  );
                }, 1000);
              }, 1000);

              break;
            }
          }
        }
      },
      10
    );
  }
}

function commandCloseDialog(dialogTitle = null) {
  if (!state.dialogs || state.dialogs.size < 1) return;

  if (dialogTitle) {
    if (state.dialogs.has(dialogTitle)) {
      let _dialog = state.dialogs.get(dialogTitle);
      if (_dialog.closeButton) {
        _dialog.closeButton.click();
      } else {
        let _dialogElem = _findDialogElement(dialogTitle);
        if (_dialogElem && _dialogElem.parentElement) {
          _dialogElem.parentElement.dispatchEvent(
            new MouseEvent("mousedown", {
              view: window,
              bubbles: true,
              cancelable: true,
            })
          );
        }
      }
    }
  } else {
    let _foundBtn = false;
    for (let [_k, _v] of state.dialogs) {
      if (_v.closeButton) {
        _v.closeButton.click();
        _foundBtn = true;
        break;
      }
    }
    if (!_foundBtn) {
      let _dialogElem = _findDialogElement(dialogTitle);
      if (_dialogElem && _dialogElem.parentElement) {
        _dialogElem.parentElement.dispatchEvent(
          new MouseEvent("mousedown", {
            view: window,
            bubbles: true,
            cancelable: true,
          })
        );
      }
    }
  }
}

function commandReturnToHomeScreen() {
  let _btnFound = false;
  let _btns = document.querySelectorAll('[role="button"]');
  for (let i = 0; i < _btns.length; i++) {
    if (
      _btns[i] &&
      _btns[i].textContent &&
      _btns[i].textContent.includes("Return to home screen")
    ) {
      _btnFound = true;
      _btns[i].click();
      break;
    }
  }
  if (!_btnFound) {
    window.location.href = "https://meet.google.com/";
  }
}

function commandRejoin() {
  let _btns = document.querySelectorAll('[role="button"]');
  for (let i = 0; i < _btns.length; i++) {
    if (
      (_btns[i] &&
        _btns[i].textContent &&
        _btns[i].textContent.includes("Rejoin")) ||
      _btns[i].textContent.includes("Join")
    ) {
      _btns[i].click();
      break;
    }
  }
}

function commandJoinMeeting(meetingId) {
  window.location.href = "https://meet.google.com/" + meetingId;
}

function commandStartNewMeeting(meetingNick = null) {
  let _btnFound = false;
  let _btns = document.querySelectorAll('[role="button"]');
  for (let i = 0; i < _btns.length; i++) {
    if (
      _btns[i] &&
      _btns[i].textContent &&
      _btns[i].textContent
        .toLocaleLowerCase()
        .includes("join or start a meeting")
    ) {
      _btnFound = true;
      _btns[i].click();
      break;
    }
  }
  if (_btnFound) {
    waitForElement(
      '[role="dialog"]',
      document,
      function (_elmAsked, _elmGot) {
        if (_elmGot) {
          if (meetingNick && meetingNick.length > 0) {
            let _textbox = _elmGot.querySelector('input[type="text"]');
            if (_textbox) {
              _textbox.value = meetingNick;
            }
          }
          let _btns = document.querySelectorAll('[role="button"]');
          for (let i = 0; i < _btns.length; i++) {
            if (
              _btns[i] &&
              _btns[i].textContent &&
              _btns[i].textContent.toLocaleLowerCase().includes("continue")
            ) {
              _btns[i].click();
              break;
            }
          }
        }
      },
      10
    );
  }
}

/* * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2004 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** *
 */

function onLoad() {
  window.arguments[1].value = "";
  var keyIdText = document.getElementById("keyIdText");
  var emailRow = document.getElementById("emailRow");
  var keyText;

  if (typeof(window.arguments[0].keyId) == "string") {
    var keyId = window.arguments[0].keyId;
    if (window.arguments[0].upload) {
      keyText = EnigGetString("uploadKey", keyId);
    }
    else {
      keyText = EnigGetString("importKey", keyId);
    }

    if (keyText.length > 400) {
      keyText = keyText.substr(0, 400) + " ...";
    }
    keyIdText.firstChild.data = keyText;
    emailRow.setAttribute("collapsed", "true");
  }
  else {
    keyIdText.setAttribute("collapsed", "true");
  }

  var keyservers = EnigGetPref("keyserver").split(/[ ,;]/g);
  var menulist = document.getElementById("selectedServer");

  for (var i = 0; i < keyservers.length; i++) {
    if (keyservers[i].length > 0) {
      menulist.appendItem(keyservers[i]);
    }
  }
  document.getElementById("selectedServer").value = keyservers[0];
}

function onAccept() {
  var menulist = document.getElementById("selectedServer");
  window.arguments[1].value = menulist.value;
  if (typeof(window.arguments[0].keyId) != "string") {
    window.arguments[1].email = document.getElementById("email").value;
    if (!window.arguments[1].email) {
      EnigAlert(EnigGetString("noEmailProvided"));
      return false;
    }
  }
  var selected = menulist.selectedIndex;

  if (selected !== 0) {
    var servers = [menulist.value];
    var nodes = menulist.menupopup.getElementsByTagName('menuitem');
    for (var i = 0, e = nodes.length; i < e; ++i) {
      if (i == selected) {
        continue;
      }
      servers.push(nodes[i].label);
    }
    EnigSetPref("keyserver", servers.join(', '));
  }
  return true;
}
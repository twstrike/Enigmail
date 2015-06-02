/* ***** BEGIN LICENSE BLOCK *****
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
 * Copyright (C) 2003 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s): Ludwig Hügelschäfer <ludwig@hammernoch.net>
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
 * ***** END LICENSE BLOCK ***** */

// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailWrapSelection");


function onLoad () {
  DEBUG_LOG("enigmailWrapSelection.js: onLoad\n");
  window.arguments[0].cancelled = true;
  window.arguments[0].Select = "";
}

function onAccept () {
  DEBUG_LOG("enigmailWrapSelection.js: onAccept\n");
  WrapSelect=document.getElementById("WrapSelectGroup");
  DEBUG_LOG("enigmailWrapSelection.js: onAccept, selected value='"+WrapSelect.value+"'\n");
  if (WrapSelect.value !== "") {
    window.arguments[0].Select = WrapSelect.value;
    window.arguments[0].cancelled = false;
    DEBUG_LOG("enigmailWrapSelection.js: onAccept, setting return value, disable cancel\n");
  }
  else
  {
    DEBUG_LOG("enigmailWrapSelection.js: onAccept, enable cancel\n");
    window.arguments[0].cancelled=true;
  }
}

function onCancel () {
  DEBUG_LOG("enigmailWrapSelection.js: onCancel, enable cancel\n");
  window.arguments[0].cancelled=true;
}

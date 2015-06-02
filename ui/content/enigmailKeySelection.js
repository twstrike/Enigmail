/*global Components */
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
 * ***** END LICENSE BLOCK ***** */

// Uses: chrome://enigmail/content/enigmailCommon.js

Components.utils.import("resource://enigmail/enigmailCommon.jsm");

// Initialize enigmailCommon
EnigInitCommon("enigmailKeySelection");

const INPUT = 0;
const RESULT = 1;

// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const KEY_TRUST=1;
const KEY_ID = 4;
const CREATED = 5;
const EXPIRY = 6;
const USER_ID = 9;
const KEY_USE_FOR = 11;

// key trust values for field 1 (as described in the doc/DETAILS file in the GnuPG distribution)
const KEY_EXPIRED="e";
const KEY_REVOKED="r";
const KEY_INVALID="i";
const KEY_DISABLED="d";
const KEY_NOT_VALID=KEY_EXPIRED+KEY_REVOKED+KEY_INVALID+KEY_DISABLED;
const KEY_IS_GROUP="g";

// HKP related stuff
const ENIG_DEFAULT_HKP_PORT="11371";

var gUserList;
var gResult;
var gAlwaysTrust=false;
var gSendEncrypted=true;
var gSendSigned=true;
var gAllowExpired=false;

var gEnigRemoveListener = false;
var gKeysNotFound = [];
const EMPTY_UID = " -";



function enigmailUserSelLoad()
{
  DEBUG_LOG("enigmailKeySelection.js: Load\n");
  window.enigIpcRequest = null;
  if (window.arguments[INPUT].options.indexOf("private")>= 0) {
    document.getElementById("enigmailKeySelectionDlg").setAttribute("title", EnigGetString("userSel.secretKeySel.title"));
  }
  document.getElementById("enigmailUserIdSelection").addEventListener('click', onClickCallback, true);
  enigmailBuildList(false);
}


function enigmailRefreshKeys()
{
  // delete existing entries:
  var userTreeList = document.getElementById("enigmailUserIdSelection");
  var treeChildren = userTreeList.getElementsByAttribute("id", "enigmailUserIdSelectionChildren")[0];
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
  // rebuild new entries:
  enigmailBuildList(true);
}


function enigGetUserList(secretOnly, refresh)
{
  DEBUG_LOG("enigmailMessengerOverlay.js: enigGetUserList\n");
  var userList;
  try {
    var exitCodeObj = {};
    var statusFlagsObj = {};
    var errorMsgObj = {};

    var enigmailSvc = GetEnigmailSvc();
    if (! enigmailSvc)
      return null;
    userList = enigmailSvc.getUserIdList(secretOnly,
                                             refresh,
                                             exitCodeObj,
                                             statusFlagsObj,
                                             errorMsgObj);
    if (exitCodeObj.value !== 0) {
      EnigAlert(errorMsgObj.value);
      return null;
    }

    if (! secretOnly) {
      let groups = EnigmailCommon.getGpgGroups();

      for (var i=0; i < groups.length; i++) {
        userList += "grp:"+groups[i].alias+":"+groups[i].keylist+"\n";
      }
    }
    else {
      userList = getPubkeysFromSecretKeys(userList);
    }
  } catch (ex) {
    ERROR_LOG("ERROR in enigmailUserSelection: enigGetUserList\n");
  }

  return userList.split(/\n/);
}


// get (and display) the public keys for the found secret keys
function getPubkeysFromSecretKeys(keyString)
{
  var secretList=keyString.split(/\n/);
  var aSecretKeys = [];
  for (var i=0; i<secretList.length; i++) {
    var listRow = secretList[i].split(/:/);
    if (listRow[0] == "sec") {
      aSecretKeys.push("0x"+listRow[KEY_ID]);
    }
  }

  var enigmailSvc = GetEnigmailSvc();
  if (! enigmailSvc) {
    return null;
  }
  var pubkeys = enigmailSvc.getKeyDetails(aSecretKeys.join(" "), false);
  return pubkeys;
}


function enigmailBuildList(refresh)
{
   DEBUG_LOG("=====> enigmailBuildList()\n");
   DEBUG_LOG("enigmailKeySelection.js: enigmailBuildList\n");

   const TRUSTLEVELS_SORTED = EnigmailFuncs.trustlevelsSorted();

   // sorting criterion for dialog entries
   // - note: for active state we have values:
   //         0: not active
   //         1: active
   //         2: not selectable (red because invalid)
   var sortUsersCallback = function (a,b) {
     var r = 0;
     // 1st: sort active keys in front of not active keys
     if ((a.activeState != b.activeState) && (a.activeState == 1 || b.activeState == 1)) {
       r = (a.activeState == 1 ? -1 : 1);
     }
     // 2nd: sort keys matching invalid addresses in front non-matching addresses
     else if (a.uidMatchInvalid != b.uidMatchInvalid) {
       r = (a.uidMatchInvalid == 1 ? -1 : 1);
     }
     // 3rd: sort non-activateable keys to the end
     else if ((a.activeState != b.activeState) && (a.activeState == 2 || b.activeState == 2)) {
       r = (a.activeState === 0 ? -1 : 1);
     }
     // 4th: sort according to user IDs
     else if (a.userId.toLowerCase() < b.userId.toLowerCase()) {
       r = -1;
     }
     else if (a.userId.toLowerCase() > b.userId.toLowerCase()) {
       r = 1;
     }
     // 5th: sort according to trust level (higher index value in front)
     else if (TRUSTLEVELS_SORTED.indexOf(a.keyTrust) > TRUSTLEVELS_SORTED.indexOf(b.keyTrust)) {
       r = -1;
     }
     else {
       r = 1;
     }
     return r;
   };

   window.arguments[RESULT].cancelled=true;

   gAlwaysTrust = (EnigGetPref("acceptedKeys") == 1);

   var secretOnly = (window.arguments[INPUT].options.indexOf("private")>= 0);
   var hideExpired = (window.arguments[INPUT].options.indexOf("hidexpired")>= 0);
   gAllowExpired = (window.arguments[INPUT].options.indexOf("allowexpired")>= 0);

   if (window.arguments[INPUT].options.indexOf("trustallkeys")>= 0) {
     gAlwaysTrust = true;
   }

   var aGpgUserList = enigGetUserList(secretOnly, refresh);

   if (!aGpgUserList) return;
   var uidNotValid;
   if (gAlwaysTrust) {
     uidNotValid="";
   }
   else {
     uidNotValid="o-qn";
   }

   try {
     if (window.arguments[INPUT].dialogHeader) {
       var dialogHeader = document.getElementById("dialogHeader");
       if (dialogHeader) {
         dialogHeader.setAttribute("label", window.arguments[INPUT].dialogHeader);
         dialogHeader.removeAttribute("collapsed");
       }
     }
     var dialogMsgList = document.getElementById("dialogMsgList");
     if (dialogMsgList) {
       // clear the list (otherwise it grows with each loaded missing key)
       while (dialogMsgList.getRowCount() > 0) {
         dialogMsgList.removeIndexAt(0);
       }
       // fill the list according to the error messages
       if (window.arguments[INPUT].errArray && window.arguments[INPUT].errArray.length > 0) {
         var array = window.arguments[INPUT].errArray;
         for (var detIdx=0; detIdx<array.length; ++detIdx) {
           var msg = null;
           switch (array[detIdx].msg) {
             case "ProblemNoKey":
               msg = EnigGetString("userSel.problemNoKey");
               break;
             case "ProblemMultipleKeys":
               msg = EnigGetString("userSel.problemMultipleKeys");
               break;
             default:
               DEBUG_LOG("missing label for '" + array[detIdx].msg + "'\n");
               msg = "???";
               break;
           }
           var row = document.createElement('listitem');
           var cell = document.createElement('listcell');
           cell.setAttribute('label', array[detIdx].addr + ":");
           row.appendChild(cell);
           cell = document.createElement('listcell');
           cell.setAttribute('label', msg);
           row.appendChild(cell);
           dialogMsgList.appendChild(row);
         }
         dialogMsgList.setAttribute("rows", (array.length<3 ? array.length : 3));
         dialogMsgList.removeAttribute("collapsed");
       }
       else {
         dialogMsgList.setAttribute("collapsed","true");
       }
     }
   } catch (ex) {
     DEBUG_LOG("EXCEPTION: " + ex + "\n");
   }

   if (secretOnly) {
      // rename expired row to created
      document.getElementById("expCol").setAttribute("label",EnigGetString("createdHeader"));
   }
   gUserList = document.getElementById("enigmailUserIdSelection");
   gUserList.currentItem=null;

   if (window.arguments[INPUT].options.indexOf("unsigned")>= 0) {
      gSendSigned = false;
      var sendSignedCheckbox = document.getElementById("enigmailUserSelSendSigned");
      sendSignedCheckbox.setAttribute("checked","false");
   }
   if ((window.arguments[INPUT].options.indexOf("rulesOption") < 0)) {
      var rulesOption = document.getElementById("enigmailKeySelectionDlg").getButton("extra1");
      rulesOption.setAttribute("hidden", "true");
   }

   var dialogHeaderDesc = document.getElementById("dialogHeaderDesc");
   var notFoundCapt = document.getElementById("usersNotFoundCapt");
   var treeChildren=gUserList.getElementsByAttribute("id", "enigmailUserIdSelectionChildren")[0];

   if (window.arguments[INPUT].options.indexOf("multisel") < 0) {
     // single key selection -> hide selection col
     var selColumn=document.getElementById("selectionCol");
     selColumn.setAttribute("collapsed", "true");
     gUserList.setAttribute("hidecolumnpicker", "true");
   }

   if (window.arguments[INPUT].options.indexOf("nosending") >= 0) {
      // hide not found recipients, hide "send unencrypted"
      document.getElementById("dialogHeadline").setAttribute("collapsed", "true");
      document.getElementById("enigmailUserSelSendSigned").setAttribute("collapsed", "true");
      document.getElementById("enigmailUserSelSendEncrypted").setAttribute("collapsed", "true");
      document.getElementById("importMissingKeys").setAttribute("collapsed", "true");
   }
   else if (window.arguments[INPUT].options.indexOf("noforcedisp") >= 0) {
      document.getElementById("displayNoLonger").removeAttribute("collapsed");
   }

   if (window.arguments[INPUT].options.indexOf("noplaintext") >= 0) {
      // hide "send unencrypted"
      document.getElementById("enigmailUserSelSendEncrypted").setAttribute("collapsed", "true");
   }

   if (window.arguments[INPUT].options.indexOf("forUser") >=0 ) {
      // display title message for Per-Recipient Rule
      dialogHeaderDesc.firstChild.data=EnigGetString("keysToUse", window.arguments[INPUT].forUser);
      dialogHeaderDesc.removeAttribute("collapsed");
      notFoundCapt.setAttribute("collapsed", "true");
   }

   if (window.arguments[INPUT].options.indexOf(",sendlabel=") >= 0) {
      var pos1 = window.arguments[INPUT].options.indexOf(",sendlabel=");
      pos1 = window.arguments[INPUT].options.indexOf("=",pos1);
      var pos2 = window.arguments[INPUT].options.indexOf(",",pos1);
      var acceptButton = document.getElementById("enigmailKeySelectionDlg").getButton("accept");
      acceptButton.setAttribute("label", window.arguments[INPUT].options.substring(pos1+1,pos2));
   }

   var aUserList = [];
   var userObj = {};
   userObj.uidMatchInvalid = false;  // by default don't match list of invalid emails
   var i;
   for (i=0; i<aGpgUserList.length; i++) {
     var listRow=aGpgUserList[i].split(/:/);
     if (listRow.length>=0) {
       switch(listRow[0]) {
       case "pub":
       case "sec":
         userObj = {};
         userObj.expiry=listRow[EXPIRY];
         userObj.created=listRow[CREATED];
         userObj.keyId=listRow[KEY_ID];
         userObj.keyTrust=listRow[KEY_TRUST];
         if (listRow[KEY_USE_FOR].indexOf("D")>=0) {
           userObj.keyTrust=KEY_DISABLED;
         }
         userObj.valid=false;
         userObj.uidValid=true;
         userObj.subkeyOK=(listRow[KEY_USE_FOR].indexOf("e") >= 0 || secretOnly);
         userObj.SubUserIds=[];
         aUserList.push(userObj);
         break;
       case "grp":
         // groups
         userObj = {};
         userObj.expiry="";
         userObj.created=1;
         userObj.keyTrust=KEY_IS_GROUP;
         userObj.valid=true;
         userObj.uidValid=true;
         userObj.subkeyOK=true;
         userObj.userId=EnigConvertGpgToUnicode(listRow[1]).replace(/\\e3A/g, ":");
         userObj.keyId=userObj.userId;
         userObj.SubUserIds=[];
         var grpMembers=EnigConvertGpgToUnicode(listRow[2]).replace(/\\e3A/g, ":").split(/[,;]/);
         for (var grpIdx=0; grpIdx<grpMembers.length; grpIdx++) {
           userObj.SubUserIds.push({ userId: grpMembers[grpIdx], trustLevel: "q" });
         }
         aUserList.push(userObj);
         break;
       case "uid":
         if (listRow[USER_ID].length === 0) {
            listRow[USER_ID] = EMPTY_UID;
         }
         if (typeof(userObj.userId) != "string") {
           // primary UID
           userObj.userId=EnigConvertGpgToUnicode(listRow[USER_ID]).replace(/\\e3A/g, ":");
            if (TRUSTLEVELS_SORTED.indexOf(listRow[KEY_TRUST]) < TRUSTLEVELS_SORTED.indexOf(userObj.keyTrust)) {
            // reduce key trust if primary UID is less trusted than public key
            userObj.keyTrust = listRow[KEY_TRUST];
          }
         }
         else {
           var userId = {
             userId: EnigConvertGpgToUnicode(listRow[USER_ID]).replace(/\\e3A/g, ":"),
             trustLevel: listRow[KEY_TRUST]
           };
           userObj.SubUserIds.push(userId);
         }
         break;
       case "sub":
         if ((listRow[KEY_USE_FOR].indexOf("e")>=0) &&
             (KEY_NOT_VALID.indexOf(listRow[KEY_TRUST])<0)) {
           userObj.subkeyOK=true;
         }
         break;
       case "tru":
         if (listRow[1].indexOf("t") >=0) {
            gAlwaysTrust=true;
         }
       }
     }
   }

   var toKeys = "";
   try{
     if (typeof(window.arguments[INPUT].toKeys)=="string") {
        toKeys=window.arguments[INPUT].toKeys;
     }
   }
   catch (ex) {}

   var invalidAddr = "";
   try {
     // the test below had "&& !refresh" probably not to list invalid keys
     // anymore after refreshing.
     // However, that's confusing because with the after refreshing keys
     // with no change in the key set, different items are selected.
     // Thus, this is disabled until there is a reprocessing of validity.
     if (typeof(window.arguments[INPUT].invalidAddr)=="string") {
        invalidAddr=" "+window.arguments[INPUT].invalidAddr+" ";
     }
   }
   catch (ex) {}

   // sort out PGP keys in toAddr
   var toAddrList = getToAddrList();
   for (i=0; i<toAddrList.length; i++) {
    if (toAddrList[i].search(/^0x([0-9A-Fa-f]{8}|[0-9A-Fa-f]{16})$/)>=0) {
      var newKey=toAddrList.splice(i,1);
      toKeys += " "+newKey;
      i--;
    }
   }
   var toAddr="<"+toAddrList.join("><")+">";

   var d = new Date();
   var now=d.valueOf() / 1000;
   var aValidUsers = [];

   var mailAddr, escapedMailAddr;
   var s1;
   // Replace any non-text character c with \\c
   var escapeRegExp = new RegExp("([^a-zA-Z0-9])","g");

   // delete "empty" entries
   for (i=0; i<aUserList.length; i++) {
     if (typeof(aUserList[i].userId) != "string") {
       aUserList.splice(i, 1);
     }
   }

   // find and activate keys
   try {
      for (i=0; i<aUserList.length; i++) {
        aUserList[i].activeState = (gAllowExpired ? 0 : 2);  // default: not activated/activateable
        if (aUserList[i].keyTrust != KEY_IS_GROUP) {
          // handling of "normal" keys
          try {
            mailAddr = EnigStripEmail(aUserList[i].userId).toLowerCase();
          }
          catch (ex) {
            mailAddr = EnigStripEmail(aUserList[i].userId.replace(/\"/g,"")).toLowerCase();
          }
          if (mailAddr != EMPTY_UID && invalidAddr.indexOf(" "+mailAddr+" ") >= 0) {
            aUserList[i].uidMatchInvalid = true;  // found matching but invalid email
          }
          if (((!aUserList[i].keyTrust) ||
                KEY_NOT_VALID.indexOf(aUserList[i].keyTrust)<0) &&
                aUserList[i].subkeyOK &&
                (aUserList[i].expiry<=0 ||
                (aUserList[i].expiry >= now))) {
              // key still valid
              aUserList[i].valid=true;
              escapedMailAddr=mailAddr.replace(escapeRegExp, "\\$1");

              s1 = new RegExp("<"+escapedMailAddr+">","i");
              if (mailAddr != EMPTY_UID) {
                if (invalidAddr.indexOf(" "+mailAddr+" ")<0) {
                  aValidUsers.push(mailAddr);
                  aUserList[i].activeState = (toAddr.search(s1)>=0 ? 1 : 0);
                }
                else {
                  // mail address found as invalid address: marks that to sort them to the beginning
                  aUserList[i].uidMatchInvalid = true;
                  aUserList[i].uidValid = false;
                  aUserList[i].activeState = 0;
                }
              }
              else {
                aUserList[i].uidValid = false;
                aUserList[i].activeState = 0;
              }
              if (aUserList[i].activeState===0 && toKeys.length>0) {
                aUserList[i].activeState=(toKeys.indexOf("0x"+aUserList[i].keyId)>=0 ? 1 : 0);
              }
          }
        }
        else {
          // special handling for gpg groups
          mailAddr = EnigStripEmail(aUserList[i].userId).toLowerCase();
          aValidUsers.push(mailAddr);
          aUserList[i].valid = true;
          aUserList[i].uidValid = true;
          if (toKeys.length > 0) {
            aUserList[i].activeState=(toKeys.indexOf("GROUP:"+aUserList[i].keyId+",")>=0 ? 1 : 0);
          }
          else
            aUserList[i].activeState = 0;
        }

        if (! hideExpired || aUserList[i].activeState < 2) {
          if ((aUserList[i].keyTrust != KEY_IS_GROUP) && aUserList[i].SubUserIds.length) {
            for (let user=0; user<aUserList[i].SubUserIds.length; user++) {
              if (KEY_NOT_VALID.indexOf(aUserList[i].SubUserIds[user].trustLevel)<0) {
                if (aUserList[i].activeState < 2 || gAllowExpired) {
                  // add uid's for valid keys
                  try {
                    mailAddr = EnigStripEmail(aUserList[i].SubUserIds[user].userId);
                  }
                  catch (ex) {
                    mailAddr = EnigStripEmail(aUserList[i].SubUserIds[user].userId.replace(/\"/g,""));
                  }
                  if (uidNotValid.indexOf(aUserList[i].SubUserIds[user].trustLevel)<0) {
                    aValidUsers.push(mailAddr);
                    aUserList[i].valid=true;
                    escapedMailAddr=mailAddr.replace(escapeRegExp, "\\$1");
                    s1=new RegExp("<"+escapedMailAddr+">","i");
                    if ((mailAddr != EMPTY_UID) && (toAddr.search(s1)>=0)) {
                      aUserList[i].activeState = 1;
                    }
                  }
                }
              }
            }
          }
        }
      }
   }
   catch (ex) {
      ERROR_LOG("enigmailKeySelection.js: ERROR in enigmailUserSelLoad:\n");
      ERROR_LOG("  userId="+aUserList[i].userId+" expiry="+ aUserList[i].expiry+"\n");
      if ((typeof user)=="number" && (typeof aUserList[i].SubUserIds[user].userId)=="string") {
        ERROR_LOG("  subUserId="+aUserList[i].SubUserIds[user].userId+"\n");
      }
   }

   // sort items according to sorting criterion
   aUserList.sort(sortUsersCallback);

   // Build up key treeView
   for (i=0; i<aUserList.length; i++) {
      var treeItem=null;
      if (! hideExpired || aUserList[i].activeState<2) {
        // do not show if expired keys are hidden
        if (secretOnly) {
          treeItem=enigUserSelCreateRow(aUserList[i], aUserList[i].activeState, aUserList[i].userId, aUserList[i].keyId, aUserList[i].created, "", true);
        }
        else {
          treeItem=enigUserSelCreateRow(aUserList[i], aUserList[i].activeState, aUserList[i].userId, aUserList[i].keyId, aUserList[i].expiry, aUserList[i].keyTrust, aUserList[i].uidValid);
        }
        if (aUserList[i].SubUserIds.length) {
          var subChildren=document.createElement("treechildren");
          for (let user=0; user<aUserList[i].SubUserIds.length; user++) {
            if (KEY_NOT_VALID.indexOf(aUserList[i].SubUserIds[user].trustLevel)<0) {
              var subItem=enigUserSelCreateRow(aUserList[i], -1, aUserList[i].SubUserIds[user].userId, "", "", aUserList[i].SubUserIds[user].trustLevel, true);
              subChildren.appendChild(subItem);
            }
          }
          if (subChildren.hasChildNodes()) {
            treeItem.setAttribute("container", "true");
            treeItem.appendChild(subChildren);
          }
        }
      }
      if (treeItem) {
        treeChildren.appendChild(treeItem);
      }
   }

   // Build up list of not found recipients
   gKeysNotFound = [];
   var j;
   for (i=0; i<toAddrList.length; i++) {
     if (toAddrList[i].length>0) {
        let found = false;
        for (j=0; j<aValidUsers.length; j++) {
           if (aValidUsers[j].toLowerCase() == toAddrList[i].toLowerCase()) {
              found = true;
              break; // the inner loop
           }
        }
        if (!found) {
           DEBUG_LOG("enigmailKeySelection.js: enigmailUserSelLoad: not found " + toAddrList[i] +"\n");
           gKeysNotFound.push(toAddrList[i]);
        }
     }
   }
   var toKeyList=toKeys.split(/[, ]+/);
   for (i=0; i<toKeyList.length; i++) {
      if (toKeyList[i].length>0) {
        let found = false;
        for (j=0; j<aUserList.length; j++) {
           if (aUserList[j].valid && "0x"+aUserList[j].keyId == toKeyList[i]) {
              found = true;
              break; // the inner loop
           }
        }
        if (!found) {
           DEBUG_LOG("enigmailKeySelection.js: enigmailUserSelLoad: not found " + toKeyList[i] +"\n");
           gKeysNotFound.push(toKeyList[i]);
        }
      }
   }

   DEBUG_LOG("  <=== enigmailBuildList()\n");
}



// create a (sub) row for the user tree
function enigUserSelCreateRow (userObj, activeState, userId, keyValue, dateField, uidValidityStatus, uidValid)
{
  var selectCol=document.createElement("treecell");
  selectCol.setAttribute("id", "indicator");
  var uidValidityCol=document.createElement("treecell");
  var expCol=document.createElement("treecell");
  var userCol=document.createElement("treecell");

  userCol.setAttribute("id", "name");
  expCol.setAttribute("id", "expiry");
  uidValidityCol.setAttribute("id", "validity");

  userCol.setAttribute("label", userId);
  expCol.setAttribute("label", EnigGetDateTime(dateField,true, false));

  var keyCol=document.createElement("treecell");
  if (userObj.keyTrust != KEY_IS_GROUP) {
    keyCol.setAttribute("label", keyValue.substring(8,16));
  }
  else {
    keyCol.setAttribute("label", EnigGetString("keyTrust.group"));
  }
  keyCol.setAttribute("id", "keyid");

  // process validity label
  var validity=EnigGetTrustLabel(uidValidityStatus.charAt(0));
  if (!uidValid) {
    if (validity == "-") {
      validity="-  ("+EnigGetString("keyTrust.untrusted").toUpperCase()+")";
    }
  }
  if (!userObj.subkeyOK && KEY_NOT_VALID.indexOf(uidValidityStatus.charAt(0))<0) {
    validity=EnigGetString("keyValid.noSubkey");
  }

  // process which row elements to make insensitive
  if ( ((userObj.keyTrust.length>0) &&
         (KEY_NOT_VALID.indexOf(userObj.keyTrust.charAt(0))>=0)) ||
       (!userObj.subkeyOK) ) {
    // disabled/revoked/expired/invalid (sub)keys inactivate whole row
    userCol.setAttribute("properties", "enigKeyInactive");
    uidValidityCol.setAttribute("properties", "enigKeyInactive");
    expCol.setAttribute("properties", "enigKeyInactive");
    keyCol.setAttribute("properties", "enigKeyInactive");
    if (!gAllowExpired && activeState>=0) {
      activeState=2;
    }
  }
  else if (!gAlwaysTrust) {
    if (("mfu".indexOf(userObj.keyTrust.charAt(0))<0) ||
        (uidValidityStatus.length>0) &&
        ("o-qn".indexOf(uidValidityStatus.charAt(0))>=0)) {
      // keys with not enough trust have insensitive elements, but are activateable
      userCol.setAttribute("properties", "enigKeyInactive");
      uidValidityCol.setAttribute("properties", "enigKeyInactive");
      expCol.setAttribute("properties", "enigKeyInactive");
      keyCol.setAttribute("properties", "enigKeyInactive");
    }
  }

  EnigSetActive(selectCol, activeState);
  uidValidityCol.setAttribute("label", validity);
  var userRow=document.createElement("treerow");
  userRow.appendChild(selectCol);
  userRow.appendChild(userCol);
  userRow.appendChild(uidValidityCol);
  userRow.appendChild(expCol);
  userRow.appendChild(keyCol);
  var treeItem=document.createElement("treeitem");
  if (userObj.keyTrust == KEY_IS_GROUP) {
    treeItem.setAttribute("id", "GROUP:"+userObj.keyId);
  }
  else {
    treeItem.setAttribute("id", "0x"+userObj.keyId);
  }
  treeItem.appendChild(userRow);
  return treeItem;
}


function enigmailUserSelAccept()
{
  DEBUG_LOG("enigmailKeySelection.js: Accept\n");

  var resultObj=window.arguments[RESULT];
  resultObj.userList = [];
  resultObj.perRecipientRules=false;
  resultObj.repeatEvaluation=false;
  var t = "";
  gUserList = document.getElementById("enigmailUserIdSelection");
  var treeChildren=gUserList.getElementsByAttribute("id", "enigmailUserIdSelectionChildren")[0];

  if (window.arguments[INPUT].options.indexOf("multisel")<0) {
    if (gUserList.currentIndex >= 0) {
      resultObj.userList.push(gUserList.view.getItemAtIndex(gUserList.currentIndex).getAttribute("id"));
      // resultObj.userList.push(gUserList.currentItem.getAttribute("id"));
    }
  }
  else {
    var item=treeChildren.firstChild;
    while (item) {
      var aRows = item.getElementsByAttribute("id","indicator");
      if (aRows.length) {
        var elem=aRows[0];
        if (elem.getAttribute("active") == "1") {
          resultObj.userList.push(item.getAttribute("id"));
        }
      }
      item = item.nextSibling;
    }
  }

  if (document.getElementById("displayNoLonger").checked) {
    // no longer force manual disalog even if no keys missing
    EnigSetPref("assignKeysByManuallyAlways", false);
  }
  if (resultObj.userList.length === 0 && gSendEncrypted) {
    EnigAlert(EnigGetString("atLeastOneKey"));
    return false;
  }

  if ((resultObj.userList.length < getToAddrList().length) && gSendEncrypted) {
    if (! EnigConfirm(EnigGetString("fewerKeysThanRecipients"), EnigGetString("dlg.button.continue"), EnigGetString("userSel.button.goBack")))
      return false;
  }

  resultObj.cancelled=false;

  resultObj.encrypt = gSendEncrypted;
  resultObj.sign = gSendSigned;
  return true;
}


function getToAddrList()
{
  var toAddrList;
  try {
    toAddrList=EnigStripEmail(window.arguments[INPUT].toAddr).split(/[ ,]+/);
  }
  catch(ex) {
    toAddrList = [];
  }
  return toAddrList;
}


function onClickCallback(event)
{
  enigmailUserSelCallback(event);
}


function enigmailUserSelCallback(event)
{
  if (!gSendEncrypted)
    return;

  var row = {};
  var col = {};
  var elt = {};
  var Tree;
  if (event.type == "keypress") {
    // key event
    if (event.charCode == 32) {
      Tree = event.target;
      if (Tree.view.selection.count > 0) {
        row.value = Tree.view.selection.currentIndex;
      }
    }
    else {
      return;
    }
  }
  else if (event.type == "click") {
    // Mouse event
    Tree = document.getElementById("enigmailUserIdSelection");
    Tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);

    if (!col.value) // not clicked on a valid column (e.g. scrollbar)
      return;

    if (event.detail > 2) return;

    if ((event.detail == 1) && (col.value.id != "selectionCol"))
      return; // single clicks are only relevant for the selection column

    if ((event.detail == 2)  && ("selectionCol,enigUserNameCol,uidValidityCol,expCol,keyCol".indexOf(col.value.id) < 0))
      return;

    event.stopPropagation();

  }

  if (row.value == -1)
    return;
  var treeItem = Tree.contentView.getItemAtIndex(row.value);
  Tree.currentItem=treeItem;
  var aRows = treeItem.getElementsByAttribute("id","indicator");

  if (event.detail == 2) {
    if (window.arguments[INPUT].options.indexOf("multisel")< 0) {
      document.getElementById("enigmailKeySelectionDlg").acceptDialog();
      return;
    }
  }

  if (aRows.length) {
    var elem=aRows[0];
    if (elem.getAttribute("active") == "1") {
      EnigSetActive(elem, 0);
    } else if (elem.getAttribute("active") == "0") {
      EnigSetActive(elem, 1);
    }
  }
}


function switchSendSignedCallback()
{
  gSendSigned = document.getElementById("enigmailUserSelSendSigned").checked;
}


function switchSendEncryptedCallback()
{
  gSendEncrypted = document.getElementById("enigmailUserSelSendEncrypted").checked;
  displayNoLonger();
  disableList();
}

function displayNoLonger()
{
  var dispMsg = document.getElementById("displayNoLonger");
  if (gSendEncrypted) {
    dispMsg.setAttribute("disabled", "true");
  }
  else {
    dispMsg.removeAttribute("disabled");
  }
}


function disableList()
{
  var Tree=document.getElementById("enigmailUserIdSelection");

  var node = Tree.firstChild.firstChild;
  while (node) {
    // set the background of all colums to gray
    if (node.localName == "treecol") {
      if (gSendEncrypted) {
        node.removeAttribute("properties");
      }
      else {
        node.setAttribute("properties", "enigDontEncrypt");
      }
    }
    node=node.nextSibling;
  }
}


function enigmailNewRecipientRule ()
{
  // enable rules to ensure that the new rule gets processed
  EnigSetPref("assignKeysByRules", true);

  var resultObj=window.arguments[RESULT];
  resultObj.userList = [];
  resultObj.repeatEvaluation=true;
  resultObj.perRecipientRules=true;
  resultObj.cancelled=false;
  resultObj.encrypt = "";
  window.close();
  return true;
}


function enigmailSearchMissingKeys ()
{
  var inputObj = {
    searchList: gKeysNotFound
  };
  var resultObj = {};

  EnigDownloadKeys(inputObj, resultObj);

  if (resultObj.importedKeys > 0) {
    resultObj=window.arguments[RESULT];
    resultObj.userList = [];
    resultObj.repeatEvaluation=true;
    resultObj.perRecipientRules=false;
    resultObj.cancelled=false;
    resultObj.encrypt = "";
    window.close();
    return true;
  }
}


function onSearchInput()
{
  gSearchInput = document.getElementById("filterKey");
  var searchValue = gSearchInput.value.toLowerCase();
  var userTreeList = document.getElementById("enigmailUserIdSelection");
  var treeChildren = userTreeList.getElementsByAttribute("id", "enigmailUserIdSelectionChildren")[0];

  if (searchValue === "") {
    // unhide all items
    for (let item=treeChildren.firstChild; item; item = item.nextSibling) {
      item.setAttribute("hidden",false);
    }
  }
  else {
    // hide items that are
    // - not active
    // - and do not match the search string in all names/emails or key
    for (let item=treeChildren.firstChild; item; item = item.nextSibling) {
      var showItem = false;
      // check active
      var aRows = item.getElementsByAttribute("id","indicator");
      if (aRows.length) {
        var elem=aRows[0];
        if (elem.getAttribute("active") == "1") {
          showItem = true;
        }
      }
      if (!showItem) {
        // check all names/emails
        let str = "";
        aRows = item.getElementsByAttribute("id","name");
        for (let r=0; r<aRows.length; ++r) {
          str += aRows[r].getAttribute("label");
        }
        if (str.toLowerCase().indexOf(searchValue) >= 0) {
          showItem = true;
        }
      }
      if (!showItem) {
        // check all keys
        let str = "";
        aRows = item.getElementsByAttribute("id","keyid");
        for (let r=0; r<aRows.length; ++r) {
          str += aRows[r].getAttribute("label");
        }
        if (str.toLowerCase().indexOf(searchValue) >= 0) {
          showItem = true;
        }
      }
      item.setAttribute("hidden",!showItem);
    }
  }
}

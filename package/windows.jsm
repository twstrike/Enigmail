/*global Components: false, escape: false */
/*jshint -W097 */
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
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Marius Stübs <marius.stuebs@riseup.net>
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapamino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
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

"use strict";

const EXPORTED_SYMBOLS = [ "Windows" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global KeyRing: false */

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";
const APPSHSVC_CONTRACTID = "@mozilla.org/appshell/appShellService;1";

const LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

const Windows = {
    /**
     * Display the OpenPGP setup wizard window
     *
     * win      : nsIWindow - the parent window
     * skipIntro: Boolean   - optional, if true, skip the introduction page
     *
     * no return value
     */
    openSetupWizard: function (win, skipIntro) {
        let param = "";
        if (skipIntro) {
            param = "?skipIntro=true";
        }
        win.open("chrome://enigmail/content/enigmailSetupWizard.xul"+param,
                 "", "chrome,centerscreen,resizable");
    },

    /**
     * Open a window, or focus it if it is already open
     *
     * @winName   : String - name of the window; used to identify if it is already open
     * @spec      : String - window URL (e.g. chrome://enigmail/content/test.xul)
     * @winOptions: String - window options as defined in nsIWindow.open
     * @optObj    : any    - an Object, Array, String, etc. that is passed as parameter
     *                       to the window
     */
    openWin: function (winName, spec, winOptions, optObj) {
        var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);

        var winEnum=windowManager.getEnumerator(null);
        var recentWin=null;
        while (winEnum.hasMoreElements() && ! recentWin) {
            var thisWin = winEnum.getNext();
            if (thisWin.location.href==spec) {
                recentWin = thisWin;
                break;
            }
            if (winName && thisWin.name && thisWin.name == winName) {
                thisWin.focus();
                break;
            }

        }

        if (recentWin) {
            recentWin.focus();
        } else {
            var appShellSvc = Cc[APPSHSVC_CONTRACTID].getService(Ci.nsIAppShellService);
            var domWin = appShellSvc.hiddenDOMWindow;
            try {
                domWin.open(spec, winName, "chrome,"+winOptions, optObj);
            }
            catch (ex) {
                domWin = windowManager.getMostRecentWindow(null);
                domWin.open(spec, winName, "chrome,"+winOptions, optObj);
            }
        }
    },

    /**
     * Determine the best possible window to serve as parent window for dialogs.
     *
     * @return: nsIWindow object
     */
    getBestParentWin: function() {
        var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);

        var bestFit = null;
        var winEnum=windowManager.getEnumerator(null);

        while (winEnum.hasMoreElements()) {
            var thisWin = winEnum.getNext();
            if (thisWin.location.href.search(/\/messenger.xul$/) > 0) {
                bestFit = thisWin;
            }
            if (! bestFit && thisWin.location.href.search(/\/messengercompose.xul$/) > 0) {
                bestFit = thisWin;
            }
        }

        if (! bestFit) {
            winEnum=windowManager.getEnumerator(null);
            bestFit = winEnum.getNext();
        }

        return bestFit;
    },

    /**
     * Iterate through the frames of a window and return the first frame with a
     * matching name.
     *
     * @win:       nsIWindow - XUL window to search
     * @frameName: String    - name of the frame to seach
     *
     * @return:    the frame object or null if not found
     */
    getFrame: function(win, frameName) {
        Log.DEBUG("enigmailCommon.jsm: getFrame: name="+frameName+"\n");
        for (var j=0; j<win.frames.length; j++) {
            if (win.frames[j].name == frameName) {
                return win.frames[j];
            }
        }
        return null;
    },

    getMostRecentWindow: function() {
        var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
        return windowManager.getMostRecentWindow(null);
    },


    /**
     * Display the key help window
     *
     * @source - |string| containing the name of the file to display
     *
     * no return value
     */

    openHelpWindow: function (source) {
        Windows.openWin("enigmail:help",
                        "chrome://enigmail/content/enigmailHelp.xul?src="+source,
                        "centerscreen,resizable");
    },

    /**
     * Display the "About Enigmail" window
     *
     * no return value
     */
    openAboutWindow: function () {
        Windows.openWin("about:enigmail",
                        "chrome://enigmail/content/enigmailAbout.xul",
                        "resizable,centerscreen");
    },

    /**
     * Display the Per-Recipient Rules editor window
     *
     * no return value
     */
    openRulesEditor: function () {
        Windows.openWin("enigmail:rulesEditor",
                        "chrome://enigmail/content/enigmailRulesEditor.xul",
                        "dialog,centerscreen,resizable");
    },

    /**
     * Display the OpenPGP key manager window
     *
     * no return value
     */
    openKeyManager: function (win) {
        EnigmailCore.getService(win);

        Windows.openWin("enigmail:KeyManager",
                        "chrome://enigmail/content/enigmailKeyManager.xul",
                        "resizable");
    },

    /**
     * Display the key creation window
     *
     * no return value
     */
    openKeyGen: function () {
        Windows.openWin("enigmail:generateKey",
                        "chrome://enigmail/content/enigmailKeygen.xul",
                        "chrome,modal,resizable=yes");
    },

    /**
     * Display the card details window
     *
     * no return value
     */
    openCardDetails: function () {
        Windows.openWin("enigmail:cardDetails",
                        "chrome://enigmail/content/enigmailCardDetails.xul",
                        "centerscreen");
    },


    /**
     * Display the console log window
     *
     * @win       - |object| holding the parent window for the dialog
     *
     * no return value
     */
    openConsoleWindow: function () {
        Windows.openWin("enigmail:console",
                        "chrome://enigmail/content/enigmailConsole.xul",
                        "resizable,centerscreen");
    },

    /**
     * Display the window for the debug log file
     *
     * @win       - |object| holding the parent window for the dialog
     *
     * no return value
     */
    openDebugLog: function(win) {
        Windows.openWin("enigmail:logFile",
                        "chrome://enigmail/content/enigmailViewFile.xul?viewLog=1&title="+escape(Locale.getString("debugLog.title")),
                        "resizable,centerscreen");
    },

    /**
     * Display the preferences dialog
     *
     * @win       - |object| holding the parent window for the dialog
     * @showBasic - |boolean| true if only the 1st page of the preferences window
     *              should be displayed / false otherwise
     * @selectTab - |string| ID of the tab element (in XUL) to display when opening
     *
     * no return value
     */
    openPrefWindow: function (win, showBasic, selectTab) {
        Log.DEBUG("windows.js: openPrefWindow\n");

        EnigmailCore.getService(win, true);  // true: starting preferences dialog

        win.openDialog("chrome://enigmail/content/pref-enigmail.xul",
                       "_blank", "chrome,resizable=yes",
                       {'showBasic': showBasic,
                        'clientType': 'thunderbird',
                        'selectTab': selectTab});
    },

    /**
     * Display the dialog for creating a new per-recipient rule
     *
     * @win          - |object| holding the parent window for the dialog
     * @emailAddress - |string| containing the email address for the rule
     *
     * @return       - always true
     */
    createNewRule: function (win, emailAddress) {
        // make sure the rules database is loaded
        const enigmailSvc = EnigmailCore.getService(win);
        if (!enigmailSvc) {
            return false;
        }

        // open rule dialog
        enigmailSvc.getRulesData({});

        const inputObj = {
            toAddress: "{"+emailAddress+"}",
            options: "",
            command: "add"
        };
        win.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul","",
                       "dialog,modal,centerscreen,resizable", inputObj, {});
        return true;
    },

    /**
     * Display the dialog for changing the expiry date of one or several keys
     *
     * @win        - |object| holding the parent window for the dialog
     * @userIdArr  - |array| of |strings| containing the User IDs
     * @keyIdArr   - |array| of |strings| containing the key IDs (eg. "0x12345678") to change
     * no return value
     */
    editKeyExpiry: function (win, userIdArr, keyIdArr) {
        const inputObj = {
            keyId: keyIdArr,
            userId: userIdArr
        };
        const resultObj = { refresh: false };
        win.openDialog("chrome://enigmail/content/enigmailEditKeyExpiryDlg.xul","",
                       "dialog,modal,centerscreen,resizable", inputObj, resultObj);
        return resultObj.refresh;
    },

    /**
     * Display the dialog for changing key trust of one or several keys
     *
     * @win        - |object| holding the parent window for the dialog
     * @userIdArr  - |array| of |strings| containing the User IDs
     * @keyIdArr   - |array| of |strings| containing the key IDs (eg. "0x12345678") to change
     * no return value
     */
    editKeyTrust: function (win, userIdArr, keyIdArr) {
        const inputObj = {
            keyId: keyIdArr,
            userId: userIdArr
        };
        const resultObj = { refresh: false };
        win.openDialog("chrome://enigmail/content/enigmailEditKeyTrustDlg.xul","",
                       "dialog,modal,centerscreen,resizable", inputObj, resultObj);
        return resultObj.refresh;
    },


    /**
     * Display the dialog for signing a key
     *
     * @win        - |object| holding the parent window for the dialog
     * @userId     - |string| containing the User ID (for displaing in the dialog only)
     * @keyId      - |string| containing the key ID (eg. "0x12345678")
     * no return value
     */
    signKey: function (win, userId, keyId) {
        const inputObj = {
            keyId: keyId,
            userId: userId
        };
        const resultObj = { refresh: false };
        win.openDialog("chrome://enigmail/content/enigmailSignKeyDlg.xul","",
                       "dialog,modal,centerscreen,resizable", inputObj, resultObj);
        return resultObj.refresh;
    },

    /**
     * Display the photo ID associated with a key
     *
     * @win        - |object| holding the parent window for the dialog
     * @keyId      - |string| containing the key ID (eg. "0x12345678")
     * @userId     - |string| containing the User ID (for displaing in the dialog only)
     * @photoNumber - |number| UAT entry in the squence of appearance in the key listing, starting with 0
     * no return value
     */
    showPhoto: function (win, keyId, userId, photoNumber) {
        const enigmailSvc = EnigmailCore.getService(win);
        if (enigmailSvc) {
            if (photoNumber === null) photoNumber=0;

            if (keyId.search(/^0x/) < 0) {
                keyId = "0x" + keyId;
            }

            const exitCodeObj = {};
            const photoPath = KeyRing.showKeyPhoto(keyId, photoNumber, exitCodeObj, {});

            if (photoPath && exitCodeObj.value===0) {
                const photoFile = Cc[LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
                photoFile.initWithPath(photoPath);

                if (! (photoFile.isFile() && photoFile.isReadable())) {
                    Windows.alert(win, Locale.getString("error.photoPathNotReadable", photoPath));
                } else {
                    const photoUri = Cc[IOSERVICE_CONTRACTID].getService(Ci.nsIIOService).
                              newFileURI(photoFile).spec;
                    const argsObj = {
                        photoUri: photoUri,
                        userId: userId,
                        keyId: keyId
                    };

                    win.openDialog("chrome://enigmail/content/enigmailDispPhoto.xul",
                                   photoUri,
                                   "chrome,modal,resizable,dialog,centerscreen",
                                   argsObj);
                    try {
                        // delete the photo file
                        photoFile.remove(false);
                    } catch (ex) {}
                }
            } else {
                Windows.alert(win, Locale.getString("noPhotoAvailable"));
            }
        }
    },

    /**
     * Display the OpenPGP Key Details window
     *
     * @win        - |object| holding the parent window for the dialog
     * @keyId      - |string| containing the key ID (eg. "0x12345678")
     * @refresh    - |boolean| if true, cache is cleared and the key data is loaded from GnuPG
     *
     * no return value
     */
    openKeyDetails: function (win, keyId, refresh) {
        const keyListObj = {};

        keyId = keyId.replace(/^0x/, "");

        KeyRing.loadKeyList(win, refresh, keyListObj);

        const inputObj = {
            keyId:  keyId,
            keyListArr: keyListObj.keyList,
            secKey: keyListObj.keyList[ keyId ].secretAvailable
        };
        const resultObj = { refresh: false };
        win.openDialog("chrome://enigmail/content/enigmailKeyDetailsDlg.xul", "",
                       "dialog,modal,centerscreen,resizable", inputObj, resultObj);
        if(resultObj.refresh) {
            // TODO: look at this usage - it doesn't seem to refer to any function here
            /*global enigmailRefreshKeys: false */
            enigmailRefreshKeys();
        }
    },

    /**
     * Display the dialog to search and/or download key(s) from a keyserver
     *
     * @win        - |object| holding the parent window for the dialog
     * @inputObj   - |object| with member searchList (|string| containing the keys to search)
     * @resultObj  - |object| with member importedKeys (|number| containing the number of imporeted keys)
     *
     * no return value
     */
    downloadKeys: function (win, inputObj, resultObj) {
        Log.DEBUG("windows.jsm: downloadKeys: searchList="+inputObj.searchList+"\n");

        resultObj.importedKeys=0;

        const ioService = Cc[IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
        if (ioService && ioService.offline) {
            Windows.alert(win, Locale.getString("needOnline"));
            return;
        }

        let valueObj = {};
        if (inputObj.searchList) {
            valueObj = { keyId: "<"+inputObj.searchList.join("> <")+">" };
        }

        const keysrvObj = {};

        win.openDialog("chrome://enigmail/content/enigmailKeyserverDlg.xul",
                       "", "dialog,modal,centerscreen", valueObj, keysrvObj);
        if (!keysrvObj.value) {
            return;
        }

        inputObj.keyserver = keysrvObj.value;

        if (! inputObj.searchList) {
            const searchval = keysrvObj.email.
                      replace(/^(\s*)(.*)/, "$2").
                      replace(/\s+$/,"");  // trim spaces
            // special handling to convert fingerprints with spaces into fingerprint without spaces
            if (searchval.length == 49 && searchval.match(/^[0-9a-fA-F ]*$/) &&
                searchval[4]==' ' && searchval[9]==' ' && searchval[14]==' ' &&
                searchval[19]==' ' && searchval[24]==' ' && searchval[29]==' ' &&
                searchval[34]==' ' && searchval[39]==' ' && searchval[44]==' ') {
                inputObj.searchList = [ "0x" + searchval.replace(/ /g,"") ];
            } else if (searchval.length == 40 && searchval.match(/^[0-9a-fA-F ]*$/)) {
                inputObj.searchList = [ "0x" + searchval ];
            } else if (searchval.length == 8 && searchval.match(/^[0-9a-fA-F]*$/)) {
                // special handling to add the required leading 0x when searching for keys
                inputObj.searchList = [ "0x" + searchval ];
            } else if (searchval.length == 16 && searchval.match(/^[0-9a-fA-F]*$/)) {
                inputObj.searchList = [ "0x" + searchval ];
            } else {
                inputObj.searchList = searchval.split(/[,; ]+/);
            }
        }

        win.openDialog("chrome://enigmail/content/enigmailSearchKey.xul",
                       "", "dialog,modal,centerscreen", inputObj, resultObj);
    }
};

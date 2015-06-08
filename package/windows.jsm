/*global Components: false, Log: false */
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

Cu.import("resource://enigmail/log.jsm");

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";
const APPSHSVC_CONTRACTID = "@mozilla.org/appshell/appShellService;1";

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
    }
};

/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false */
/*global Rules: false, rulesListHolder: false, EC: false */
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

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("rules.jsm");

// getRulesFile
test(function getRulesFileReturnsTheFile() {
    Rules.clearRules();
    Assert.equal(EC.getProfileDirectory().path + "/pgprules.xml", Rules.getRulesFile().path);
});

// loadRulesFile
test(function loadRulesFileReturnsFalseIfNoRulesFileExists() {
    Rules.clearRules();
    var result = Rules.loadRulesFile();
    Assert.ok(!result);
});

test(function loadRulesFileReturnsFalseIfTheFileExistsButIsEmpty() {
    Rules.clearRules();
    resetting(Rules, 'getRulesFile', function() {
        return do_get_file("resources/emptyRules.xml", false);
    }, function() {
        var result = Rules.loadRulesFile();
        Assert.ok(!result);
    });
});

test(function loadRulesFileReturnsTrueIfTheFileExists() {
    Rules.clearRules();
    resetting(Rules, 'getRulesFile', function() {
        return do_get_file("resources/rules.xml", false);
    }, function() {
        var result = Rules.loadRulesFile();
        Assert.ok(result);
    });
});

function xmlToData(x) {
    var result = [];
    var node = x.firstChild.firstChild;
    while(node) {
        let name = node.tagName;
        let res = {tagName: name};
        if(name) {
            let attrs = node.attributes;
            for(let i = 0; i < attrs.length; i++) {
                res[attrs[i].name] = attrs[i].value;
            }
            result.push(res);
        }
        node = node.nextSibling;
    }
    return result;
}

test(function loadRulesFileSetsRulesBasedOnTheFile() {
    Rules.clearRules();
    resetting(Rules, 'getRulesFile', function() {
        return do_get_file("resources/rules.xml", false);
    }, function() {
        Rules.loadRulesFile();
        var d = xmlToData(rulesListHolder.rulesList);
        var expected = [
            {tagName: "pgpRule",
             email: "{user1@some.domain}",
             keyId: "0x1234ABCD",
             sign: "1",
             encrypt: "1",
             pgpMime: "1"},
            {tagName: "pgpRule",
             email: "user2@some.domain",
             keyId: "0x1234ABCE",
             sign: "2",
             encrypt: "1",
             pgpMime: "0"}
        ];
        Assert.deepEqual(expected, d);
    });
});

// getRulesData
test(function getRulesDataReturnsFalseAndNullIfNoRulesExist() {
    Rules.clearRules();
    var res = {};
    var ret = Rules.getRulesData(res);
    Assert.ok(!ret);
    Assert.equal(null, res.value);
});

test(function getRulesDataReturnsTrueAndTheRulesListIfExist() {
    Rules.clearRules();
    resetting(Rules, 'getRulesFile', function() {
        return do_get_file("resources/rules.xml", false);
    }, function() {
        var res = {};
        var ret = Rules.getRulesData(res);
        Assert.ok(ret);
        Assert.equal(rulesListHolder.rulesList, res.value);
    });
});

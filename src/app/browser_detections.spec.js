/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2015 Digi International Inc., All Rights Reserved.
 */

'use strict';

describe("Factory: BrowserInfo", function () {
    beforeEach(module("XBeeGatewayApp"));

    var CHROME_35 = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.153 Safari/537.36",
        FF_30 = "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:30.0) Gecko/20100101 Firefox/30.0",
        IE_9 = "Mozilla/4.0 (compatible; MSIE 9.0; Windows NT 6.1; Win64; x64; Trident/5.0)",
        QUIRKS = "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Win64; x64; Trident/5.0)";

    var APPVER_CHROME_35 = CHROME_35.substring(CHROME_35.indexOf('/') + 1),
        APPVER_FF_30 = FF_30.substring(FF_30.indexOf('/') + 1),
        APPVER_IE_9 = IE_9.substring(IE_9.indexOf('/') + 1),
        APPVER_QUIRKS = QUIRKS.substring(QUIRKS.indexOf('/') + 1);

    var _navigator = {},
        _document = {};

    beforeEach(module(function ($provide) {
        $provide.value('$window', {
            navigator: _navigator,
            document: _document
        });
    }));

    describe("(on Chrome 35)", function () {
        beforeEach(function () {
            _navigator = {
                userAgent: CHROME_35,
                appVersion: APPVER_CHROME_35
            };
        });

        it("should parse the browser info correctly", inject(function (BrowserInfo) {
            expect(BrowserInfo).toEqual({
                khtml: undefined,
                webkit: 537.36,
                chrome: 35,
                safari: undefined
            });
        }));
    });

    describe("(on Firefox 30)", function () {
        beforeEach(function () {
            _navigator = {
                userAgent: FF_30,
                appVersion: APPVER_FF_30
            };
        });

        it("should parse the browser info correctly", inject(function (BrowserInfo) {
            expect(BrowserInfo).toEqual({
                khtml: undefined,
                webkit: undefined,
                chrome: undefined,
                safari: undefined,
                mozilla: 5,
                ff: 30
            });
        }));
    });

    describe("(on IE 9)", function () {
        beforeEach(function () {
            _navigator = {
                userAgent: IE_9,
                appVersion: APPVER_IE_9
            };

            _document = {
                // On IE this is an object containing all document elements.
                all: {length: 2},
                documentMode: 9
            }
        });

        it("should parse the browser info correctly", inject(function (BrowserInfo) {
            expect(BrowserInfo).toEqual({
                khtml: undefined,
                webkit: undefined,
                chrome: undefined,
                safari: undefined,
                ie: 9
            });
        }));
    });

    describe("(on IE Quirks Mode)", function () {
        beforeEach(function () {
            _navigator = {
                userAgent: QUIRKS,
                appVersion: APPVER_QUIRKS
            };

            _document = {
                // On IE this is an object containing all document elements.
                all: {length: 2},
                documentMode: 5
            }
        });

        it("should parse the browser info correctly", inject(function (BrowserInfo) {
            expect(BrowserInfo).toEqual({
                khtml: undefined,
                webkit: undefined,
                chrome: undefined,
                safari: undefined,
                // Detect quirks mode properly
                ie: 9
            });
        }));
    });
});

/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

'use strict';

describe("Service: xbeeService", function() {
    // Load module
    beforeEach(module("XBeeGatewayApp"));

    var service;
    beforeEach(inject(function (xbeeService) {
        service = xbeeService;
    }));

    // Only used in XBee Wi-Fi
    it("should return expected values for get_stream_options('serial')", function () {
        var value = service.get_stream_options("serial");
        expect(value).toEqual( {
            cmd: "P4",
            options: [{ value: "DIN", label: "Serial Input" }]});
    });
    it("should return expected values for get_stream_options('serial', _, true)", function () {
        // type argument is ignored if stream is serial
        var value = service.get_stream_options("serial", "foo", true);
        expect(value).toEqual( {
            cmd: "P3",
            options: [{ value: "DOUT", label: "Serial Output" }]});
    });
    // Only on XBee Wi-Fi. Does not work entirely the same with the XBee
    // Gateway-specific changes.
    it("should return expected values for get_stream_options('M0', 'pwm')", function () {
        var expected = {
            cmd: undefined,  // XBee Wi-Fi would expect P0
            options: [{ value: "PWM0", label: "PWM Output" }]
        };

        // Test PWM output handling. isOutput argument ignored
        var value = service.get_stream_options("M0", "pwm", false);
        expect(value).toEqual(expected);

        value = service.get_stream_options("M0", "pwm", true);
        expect(value).toEqual(expected);
    });
    // Only on XBee Wi-Fi. Does not work entirely the same with the XBee
    // Gateway-specific changes.
    it("should return expected values for get_stream_options('M1', 'pwm')", function () {
        var expected = {
            cmd: undefined,  // XBee Wi-Fi would expect P1
            options: [{ value: "PWM1", label: "PWM Output" }]
        };

        // Test PWM output handling. isOutput argument ignored
        var value = service.get_stream_options("M1", "pwm", false);
        expect(value).toEqual(expected);

        value = service.get_stream_options("M1", "pwm", true);
        expect(value).toEqual(expected);
    });

    it("should return expected values for get_stream_options with output streams", function () {
        for (var i = 0; i < 13; i++) {
            var expected = {
                cmd: 'dio' + i + '_config',
                options: [
                    {value: '4', label: 'Digital Output - Low'},
                    {value: '5', label: 'Digital Output - High'}
                ]
            };

            expect(service.get_stream_options('DIO' + i, 'stream', true)).toEqual(expected);
        }
    });

    it("should return expected values for get_stream_options with input analog streams", function () {
        for (var i = 0; i < 4; i++) {
            var expected = {
                cmd: 'dio' + i + '_config',
                options: [{value: '2', label: 'Analog Input'}]
            };

            expect(service.get_stream_options('AD' + i, 'stream')).toEqual(expected);
            // pwm is special-cased type, everything else is handled together
            expect(service.get_stream_options('AD' + i, 'pin')).toEqual(expected);
        }
    });

    it("should return expected values for get_stream_options with digital input pins", function () {
        for (var i = 0; i < 13; i++) {
            var expected = {
                cmd: 'dio' + i + '_config',
                options: [{value: '3', label: 'Digital Input'}]
            };

            expect(service.get_stream_options('DIO' + i, 'stream')).toEqual(expected);
            // pwm is special-cased type, everything else is handled together
            expect(service.get_stream_options('DIO' + i, 'pin')).toEqual(expected);
        }
    });

    it("should determine if commands are 'IC capable' correctly", function () {
        // 3, 4, and 5 are the only command values that use IC.
        // But the value could also be a string ('3', '4', '5') so check that
        // too.)
        expect(service.cmd_ic_capable(3)).toBeTruthy();
        expect(service.cmd_ic_capable(4)).toBeTruthy();
        expect(service.cmd_ic_capable(5)).toBeTruthy();
        expect(service.cmd_ic_capable("3")).toBeTruthy();
        expect(service.cmd_ic_capable("4")).toBeTruthy();
        expect(service.cmd_ic_capable("5")).toBeTruthy();

        expect(service.cmd_ic_capable(2)).toBeFalsy();
        expect(service.cmd_ic_capable({foo: 1})).toBeFalsy();
        expect(service.cmd_ic_capable(1000)).toBeFalsy();
        expect(service.cmd_ic_capable(null)).toBeFalsy();
    });

    it("should generate IC strings properly", function () {
        // XBee Wi-Fi
        for (var i = 0; i < 10; i++) {
            var from0 = '0x' + (1 << i).toString(16);
            var from7c = '0x' + (0x7c | (1 << i)).toString(16);

            expect(service.generate_ic_str("D" + i, 0)).toBe(from0);
            expect(service.generate_ic_str("D" + i, '0x7c')).toBe(from7c);
        }

        // XBee Gateway
        for (var i = 0; i < 13; i++) {
            var cmd = 'dio' + i + '_config';
            var from0 = '0x' + (1 << i).toString(16);
            var from7c = '0x' + (0x7c | (1 << i)).toString(16);

            expect(service.generate_ic_str(cmd, 0)).toBe(from0);
            expect(service.generate_ic_str(cmd, '0x7c')).toBe(from7c);
        }

        // 0x400 == 1 << 10  (11th bit)
        expect(service.generate_ic_str("P0", 0)).toBe('0x400');
        expect(service.generate_ic_str("P0", '0x5c')).toBe('0x45c');
        // 0x800 == 1 << 11 (12th bit)
        expect(service.generate_ic_str("P1", 0)).toBe('0x800');
        expect(service.generate_ic_str("P1", '0x5c')).toBe('0x85c');

        // Command not parseable
        expect(service.generate_ic_str("foo", 0)).toBe(null);
    });
});

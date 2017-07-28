/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2015 Digi International Inc., All Rights Reserved.
 */

'use strict';

describe("Service: socket", function () {
    var io, socket, service, timeout;

    beforeEach(module("XBeeGatewayApp"));

    beforeEach(function () {
        // Mock return value of io.connect.
        socket = {
            on: jasmine.createSpy("on"),
            emit: jasmine.createSpy("emit"),
            removeListener: jasmine.createSpy("removeListener"),
            disconnect: jasmine.createSpy("disconnect"),
            socket: jasmine.createSpyObj("socket.socket", ["reconnect"])
        };
        io = window.io = {
            connect: jasmine.createSpy().andReturn(socket)
        }
    });

    beforeEach(inject(function (_socket_, $timeout) {
        service = _socket_;
        timeout = $timeout;
    }));

    it("should begin with .state indicating not connected but connecting", function () {
        expect(service.state.connected).toBe(false);
        expect(service.state.connecting).toBe(true);
    });

    it("should begin with .state indicating 'unknown' status", function () {
        expect(service.state.known).toBe(false);
    });

    it("should call io.connect('/device', ...) right away", function () {
        expect(io.connect).toHaveBeenCalledWith('/device', {transports: ['xhr-polling']});
    });

    it("should call socket.on('connect') right away", function () {
        expect(socket.on).toHaveBeenCalledWith('connect', jasmine.any(Function));
        // for code coverage completeness
        (socket.on.mostRecentCall.args[1])();
    });

    it("should call socket.on on .on or .addListener", function () {
        socket.on.reset();
        service.on("blah", null);
        // socket service wraps callbacks in an AngularJS timeout
        expect(socket.on).toHaveBeenCalledWith("blah", jasmine.any(Function));
        socket.on.reset();

        service.addListener("blah2", null);
        expect(socket.on).toHaveBeenCalledWith("blah2", jasmine.any(Function));
    });

    it("should call socket.emit on .emit", function () {
        socket.emit.reset();
        service.emit("event", "my data");
        expect(socket.emit).toHaveBeenCalledWith("event", "my data");

        service.emit("event2", "my other data");
        expect(socket.emit).toHaveBeenCalledWith("event2", "my other data");
    });

    it("should call socket.removeListener on .removeListener", function () {
        // The service's removeListener method should call
        // socket.removeListener with the same arguments
        service.removeListener("x", "y");
        expect(socket.removeListener).toHaveBeenCalledWith("x", "y");
    });

    it("should call socket.emit with a wrapped callback on .emit", function () {
        var spy = jasmine.createSpy("emit callback");
        service.emit("event 3", "more data", spy);
        expect(socket.emit).toHaveBeenCalledWith("event 3", "more data", jasmine.any(Function));
        var wrappedCb = socket.emit.mostRecentCall.args[2];
        wrappedCb(1, 2, 3);
        // the wrapped callback should do a $timeout of 0 ms, so if we flush
        // $timeout, we should see the spy being called with the arguments of
        // wrappedCb's call
        timeout.flush();
        expect(spy).toHaveBeenCalledWith(1, 2, 3);
    });

    it("should call socket.disconnect() in window.onbeforeunload", function () {
        expect(window.onbeforeunload).toBeDefined();
        expect(window.onbeforeunload).toEqual(jasmine.any(Function));

        expect(socket.disconnect).not.toHaveBeenCalled();
        window.onbeforeunload();
        expect(socket.disconnect).toHaveBeenCalled();
    });

    it("should call socket.socket.reconnect on .reconnect", function () {
        service.reconnect();
        expect(socket.socket.reconnect).toHaveBeenCalledWith();
    });

    /**
     * Helper function to trigger captured socket status listeners.
     * Could be simplified by making the spy functions actually record
     * the listeners, but then we're just re-implementing the listener logic
     * ourselves...
     */
    function trigger(name /*, args */) {
        for (var i = 0; i < socket.on.calls.length; i++) {
            var onArgs = socket.on.calls[i].args;
            if (onArgs[0] === name) {
                onArgs[1]();

                // Event handlers are wrapped in a $timeout call.
                timeout.flush();
                return;
            }
        }
        throw new Error("Event not listened for: " + name);
    }

    it("should reflect connected state on 'connect' event", function () {
        // As luck would have it, the initial state is exactly the inverse
        // of what we expect it to be after the connect event.
        expect(service.state).toEqual({
            connected: false,
            connecting: true,
            known: false
        });

        trigger('connect');

        expect(service.state).toEqual({
            connected: true,
            connecting: false,
            known: true
        });
    });

    it("should reflect disconnected state on 'disconnect' event", function () {
        // This state will never happen in reality, but it is the inverse of
        // what we expect to see after the disconnect event (so that we can
        // test for the change).
        service.state.connected = true;
        service.state.connecting = true;
        service.state.known = false;

        trigger('disconnect');

        expect(service.state).toEqual({
            connected: false,
            connecting: false,
            known: true
        });
    });

    it("should reflect reconnecting state on 'reconnecting' event", function () {
        service.state.connected = true;
        service.state.connecting = false;
        service.state.known = false;

        trigger('reconnecting');

        expect(service.state).toEqual({
            connected: false,
            connecting: true,
            known: true
        });
    });
});

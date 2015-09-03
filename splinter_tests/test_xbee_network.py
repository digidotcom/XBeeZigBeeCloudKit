#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2015 Digi International Inc., All Rights Reserved.
#

from hamcrest import *
from nose import with_setup

import splinter_tests
from utils import delete_all_dashboards, get_e2e_user, do_sleep

browser = None


def setup():
    splinter_tests.start_browser()
    global browser
    browser = splinter_tests.browser


def teardown():
    splinter_tests.kill_browser()


def login_e2e_user():
    splinter_tests.visit("/logout")
    splinter_tests.visit("/#/login/e2e_fqdn")
    assert not browser.find_by_id("login_error").visible

    browser.fill("username", "e2e_user")
    browser.fill("password", "e2e_password")
    browser.find_by_css('.btn.login-button').click()

    # Wait for a moment
    do_sleep()

    assert not browser.is_text_present("Username or password was incorrect.")


def login_account_with_xbees():
    splinter_tests.visit("/logout")
    splinter_tests.visit("/#/login")
    assert not browser.find_by_id("login_error").visible

    browser.fill("username", "test_user")
    browser.fill("password", "e2e_password")
    browser.find_by_css('.btn.login-button').click()

    # Wait for a moment
    do_sleep()

    assert not browser.is_text_present("Username or password was incorrect.")


def login_account_one_device():
    splinter_tests.visit("/logout")
    splinter_tests.visit("/#/login")
    assert not browser.find_by_id("login_error").visible

    browser.fill("username", "e2e_user_1device")
    browser.fill("password", "e2e_password")
    browser.find_by_css('.btn.login-button').click()

    # Wait for a moment
    do_sleep()

    assert not browser.is_text_present("Username or password was incorrect.")


@with_setup(login_e2e_user)
def test_page_no_xbees():
    """Node table should remain empty if no XBees are found."""
    splinter_tests.visit("/#/xbee_network")

    assert browser.is_text_present("XBee Network View")

    # Since this user has more than one gateway, it shouldn't auto-select one.
    gw_select = browser.find_by_css('select#gateway')
    assert not gw_select.is_empty()  # Check that the select box is present
    assert_that(gw_select.first.value, is_("?"))

    # Pick the first gateway
    browser.select("gateway", "0")
    do_sleep()

    # 'Fetch from' select box should be visible now
    assert browser.is_text_present("Fetch from:")
    # 'Device Cloud' is automatically selected
    fetch_from = browser.find_by_css('select#fetch_from')
    assert not fetch_from.is_empty()
    assert_that(fetch_from.first.value, is_("dc"))

    # Nodes table should be empty
    assert browser.find_by_css('table.network-table tbody tr').is_empty()


@with_setup(login_e2e_user)
def test_url_changes_with_gw_selection():
    """URL query param should change when gateway selection changes."""
    splinter_tests.visit("/#/xbee_network")

    assert browser.is_text_present("XBee Network View")

    # Since this user has more than one gateway, it shouldn't auto-select one.
    gw_select = browser.find_by_css('select#gateway')
    assert not gw_select.is_empty()  # Check that the select box is present
    assert_that(gw_select.first.value, is_("?"))

    # Pick the first gateway
    browser.select("gateway", "0")
    do_sleep()

    user = get_e2e_user("e2e_user")
    assert user is not None

    # Selected gateway should be first in order of devConnectwareId
    devices = user.devices['items']
    devices = sorted(devices, key=lambda d: d['devConnectwareId'])
    devid = devices[0]['devConnectwareId']
    assert_that(browser.url, ends_with("/xbee_network?gateway=" + devid))

    # Select the second gateway
    browser.select("gateway", "1")
    devid = devices[1]['devConnectwareId']
    assert_that(browser.url, ends_with("/xbee_network?gateway=" + devid))


@with_setup(login_e2e_user)
def test_initial_gw_selection_depends_on_query_param():
    """If gateway param is given, that gateway is selected automatically."""
    user = get_e2e_user("e2e_user")
    assert user is not None
    # Extract the first device's ID
    devices = user.devices['items']
    devices = sorted(devices, key=lambda d: d['devConnectwareId'])
    devid = devices[0]['devConnectwareId']

    splinter_tests.visit("/#/xbee_network?gateway=" + devid)

    do_sleep()

    assert browser.is_text_present("XBee Network View")

    gw_select = browser.find_by_css("select#gateway")
    assert not gw_select.is_empty()
    # Check that the first gateway is selected
    assert_that(gw_select.first.value, is_("0"))

    # 'Fetch from' select box should be visible now
    assert browser.is_text_present("Fetch from:")
    # 'Device Cloud' is automatically selected
    fetch_from = browser.find_by_css('select#fetch_from')
    assert not fetch_from.is_empty()
    assert_that(fetch_from.first.value, is_("dc"))


@with_setup(login_account_one_device)
def test_select_only_gateway():
    """If account has only one gateway, it is selected automatically."""
    splinter_tests.visit("/#/xbee_network")
    do_sleep()

    user = get_e2e_user("e2e_user_1device")
    assert user is not None
    # Extract the first device's ID
    devices = user.devices['items']
    devices = sorted(devices, key=lambda d: d['devConnectwareId'])
    devid = devices[0]['devConnectwareId']

    gw_select = browser.find_by_css('select#gateway')
    assert not gw_select.is_empty()
    assert_that(gw_select.first.value, is_("0"))
    assert_that(browser.url, ends_with("/xbee_network?gateway=" + devid))


@with_setup(login_account_with_xbees)
def test_xbees_show_up():
    """XBees (but not coordinators) should be listed in the table correctly."""
    user = get_e2e_user("test_user")
    assert user is not None
    # Extract the first device's ID
    devices = user.devices['items']
    devices = sorted(devices, key=lambda d: d['devConnectwareId'])
    devid = devices[0]['devConnectwareId']

    splinter_tests.visit("/#/xbee_network?gateway=" + devid)
    do_sleep()

    xbees = user.xbees['items']

    for xbee in xbees:
        if str(xbee.get('xpNetAddr')) != "0":
            assert browser.is_text_present(xbee['xpExtAddr'])
            assert browser.is_text_present(xbee['xpNodeId'])


@with_setup(login_account_with_xbees)
def test_linked_to_from_devices_page():
    """Devices page should deep-link to XBee Network page."""
    user = get_e2e_user("test_user")
    assert user is not None
    # Extract the first device's ID
    devices = user.devices['items']
    devices = sorted(devices, key=lambda d: d['devConnectwareId'])
    devid = devices[0]['devConnectwareId']

    splinter_tests.visit("/#/devices")
    do_sleep()

    xpath = '//td[.="{}"]/..//a[.="View"]'.format(devid)
    view_btn = browser.find_by_xpath(xpath)
    assert not view_btn.is_empty()
    assert_that(view_btn.first['href'],
                ends_with("/xbee_network?gateway=" + devid))

#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2015 Digi International Inc., All Rights Reserved.
#

import splinter_tests
from hamcrest import assert_that, ends_with, is_, is_in
from nose import with_setup
import utils

def setup():
    splinter_tests.start_browser()


def teardown():
    splinter_tests.kill_browser()


def do_logout():
    splinter_tests.visit("/logout")
    splinter_tests.visit("/#/login")
    browser = splinter_tests.browser

    # Wait up to 15 seconds for the page to load
    assert browser.is_element_present_by_css("h1.title", wait_time=15)


logout_before = with_setup(do_logout)


@logout_before
def test_at_login_page():
    """After logout, the user should end up at the login page."""
    browser = splinter_tests.browser

    # Check that we should be at the login page.
    assert_that(browser.url, ends_with("#/login"))

    # Check that "Log in" appears on screen
    assert browser.is_text_present("Log in")
    # Check the title indicates we're at the login page.
    assert_that(browser.title, is_("Login | XBee ZigBee Cloud Kit"))

    # Check that no error is on screen yet.
    assert browser.find_by_id("login_error").has_class("hide")


@logout_before
def test_title_header():
    """The 'title' h1 should read "Log in". """
    h1 = splinter_tests.browser.find_by_css("h1.title")

    assert not h1.is_empty()

    assert_that("Log in", is_in(h1.first.text))


@logout_before
def test_login_bad_credentials():
    """When the user enters bad credentials, an error appears."""
    browser = splinter_tests.browser

    # Check that no error is on screen yet.
    assert browser.find_by_id("login_error").has_class("hide")

    # Fill in bogus credentials.
    browser.fill('username', 'foo')
    browser.fill('password', 'bar')

    # Click "Log in"
    browser.find_by_css('.btn.login-button').click()

    utils.do_sleep()

    # Check that the login error has appeared.
    assert not browser.find_by_id("login_error").has_class("hide")
    assert browser.is_text_present("Username or password was incorrect.")


@logout_before
def test_login_good_credentials():
    """
    When the user enters correct credentials, they go to Dashboard
    Creation.
    """
    # First, delete all the user's dashboards.
    utils.delete_all_dashboards('e2e_user', 'e2e_password', 'e2e_fqdn')

    browser = splinter_tests.browser
    # Need to first set the login page to use 'e2e_fqdn' as server URL
    splinter_tests.visit("#/login/e2e_fqdn")

    # Check that no error is on screen yet.
    assert browser.find_by_id("login_error").has_class("hide")

    browser.fill('username', 'e2e_user')
    browser.fill('password', 'e2e_password')

    browser.find_by_css('.btn.login-button').click()

    assert not browser.is_text_present("Username or password was incorrect.")

    assert_that(browser.url, ends_with("#/setup"))

    # Log out. To do this, we must click on the username in the top right, then
    # "Log out". Splinter seems to have trouble finding the link by text, so we
    # will have to find it by CSS...
    dropdown_css = ".nav.navbar-right > li.dropdown > a.dropdown-toggle"
    dropdown = browser.find_by_css(dropdown_css)
    assert not dropdown.is_empty()  # Make sure we found it

    dropdown.click()

    browser.find_link_by_text("Log out").click()

    assert_that(browser.url, ends_with("#/login"))


@logout_before
def test_forgot_link():
    """
    The 'Forgot your User Name or Password?' link points to DC.
    """
    browser = splinter_tests.browser

    dc_forgot = "https://my.devicecloud.com/forgot_password.do"
    link = browser.find_by_css(".forgot-link")
    assert not link.is_empty()

    assert_that(link.first['href'], is_(dc_forgot))


@logout_before
def test_signup_link():
    """The 'Sign up' link should point to myacct.digi.com"""
    link = splinter_tests.browser.find_link_by_text("Sign up")

    assert not link.is_empty()

    assert_that(link.first['href'], is_("https://myacct.digi.com/"))

#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2015 Digi International Inc., All Rights Reserved.
#

# This test lives within the splinter_tests package, but it actually doesn't
# use Splinter. We just use requests to verify that the server enforces the
# CSRF checks. By verifying that the CSRF checks are enforced on requests made
# outside the application, we infer that the checks are also enforced by
# requests made by the application, and that the success of the other
# integration tests prove that the CSRF functionality is working properly.
# (In other words, we don't directly verify the application's CSRF behavior,
# but we do verify the server's behavior.)

import splinter_tests
from hamcrest import assert_that, ends_with, is_, is_in
import json
from nose import with_setup
import requests
import utils
from xbgw_dashboard.e2e_settings import e2e_users


csrftoken = None
sessionid = None


def setup():
    body = json.dumps({
        'username': e2e_users[0].username,
        'password': e2e_users[0].password,
        'cloud_fqdn': e2e_users[0].fqdn
    })
    headers = {
        'content-type': 'application/json',
        'accept': 'application/json'
    }

    r = requests.post(splinter_tests.make_url('/api/login'),
                      data=body, headers=headers)
    r.raise_for_status()

    global csrftoken, sessionid
    csrftoken = r.cookies['csrftoken']
    sessionid = r.cookies['sessionid']


def teardown():
    requests.get(splinter_tests.make_url('/logout'),
            cookies={'csrftoken': csrftoken, 'sessionid': sessionid},
            headers={'X-CSRFToken': csrftoken})


def do_request(corrupt_cookie=False, corrupt_header=False):
    """Perform a POST request against the server, and return that request
    object."""
    token = (csrftoken + "_") if corrupt_cookie else csrftoken
    header = (csrftoken + "_") if corrupt_header else csrftoken

    cookies = {
        'csrftoken': token,
        'sessionid': sessionid
    }
    headers = {
        'X-CSRFToken': header,
        'content-type': 'application/json'
    }

    r = requests.post(splinter_tests.make_url('/api/devices'),
                      data='{"mac": "00409D987654"}',
                      cookies=cookies, headers=headers)
    return r


def test_good_csrf():
    """The CSRF check should pass if both cookie and header are present."""
    req = do_request()
    assert_that(req.status_code, is_(200))


def test_bad_cookie():
    """The CSRF check should fail if the cookie value is incorrect."""
    req = do_request(corrupt_cookie=True)
    assert_that(req.status_code, is_(403))
    assert_that(req.json()['detail'],
                is_("CSRF Failed: CSRF token missing or incorrect."))


def test_bad_header():
    """The CSRF check should fail if the header value is incorrect."""
    req = do_request(corrupt_header=True)
    assert_that(req.status_code, is_(403))
    assert_that(req.json()['detail'],
                is_("CSRF Failed: CSRF token missing or incorrect."))


def test_bad_both():
    """The CSRF check should fail if both values are incorrect."""
    req = do_request(corrupt_cookie=True, corrupt_header=True)
    assert_that(req.status_code, is_(403))
    assert_that(req.json()['detail'],
                is_("CSRF Failed: CSRF token missing or incorrect."))

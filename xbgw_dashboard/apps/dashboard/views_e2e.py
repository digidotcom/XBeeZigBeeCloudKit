'''
Stubbed-out Cloud Kit backend implementation, for use in E2E testing.

By providing a stub back-end, our end-to-end tests will not require access to
Device Cloud for such operations as authentication, device listing, etc. This
gives us more control over the behavior of the server, and the application, to
perform these tests.

There is, of course, a certain amount of irony in using a stubbed backend for
"end-to-end" tests, since the purpose of an end-to-end test is to validate the
actual code, and not a faked version of it. That being said, it should be noted
that this stub backend is created for the express purpose of providing more
control over operations such as authentication and device querying than can be
achieved if we run tests against, say, the production Heroku app.

The end-to-end tests (e.g. using Protractor or Splinter - TBD) can be
configured to act against either the e2e-backend running locally, or an actual
running Heroku app. The only differences will be some added latency (due to
Device Cloud operations, etc.) and somewhat decreased control over things like
account authentication (since an account's password might be changed in Device
Cloud, but not in our stub backend).
'''

import logging
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth import get_user_model
from requests.exceptions import HTTPError
from django.conf import settings as app_settings

import re

from xbgw_dashboard.apps.dashboard import views

# Imports from apps.dashboard.views
from views import *

logger = logging.getLogger(__name__)

@ensure_csrf_cookie
@api_view(['POST'])
@authentication_classes(())
@permission_classes(())
def login_user(request):
    '''
    View to log user into the app for session-based auth
    -------------------------------------------

    '''
    try:
        username = request.DATA['username']
        password = request.DATA['password']
    except KeyError:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    if not username or not password:
        return Response(status=status.HTTP_401_UNAUTHORIZED)

    try:
        cloud_fqdn = request.DATA['cloud_fqdn']
    except KeyError:
        if 'DEFAULT_CLOUD_SERVER' in app_settings.LIB_DIGI_DEVICECLOUD:
            cloud_fqdn = app_settings.LIB_DIGI_DEVICECLOUD['DEFAULT_CLOUD_SERVER']
        else:
            return Response(status=status.HTTP_400_BAD_REQUEST)

    # generate combo username/cloud expected by auth
    usercloudid = username + \
        app_settings.LIB_DIGI_DEVICECLOUD['USERNAME_CLOUD_DELIMETER'] + cloud_fqdn
    if username and password and cloud_fqdn:
        user = authenticate(username=usercloudid,
                            password=password)
        if user is not None:
            login(request, user)

            # If specified, set the session cookie to expire when user's Web
            # Browser is closed
            persist_session = request.DATA.get('persistent_session', None)
            if (type(persist_session) is str or
                    type(persist_session) is unicode):
                persist_session = strtobool(persist_session)

            if not persist_session:
                request.session.set_expiry(0)

            return Response()
        else:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
    else:
        return Response(status=status.HTTP_400_BAD_REQUEST)

User = get_user_model()

class E2EAuth(object):
    """
    Authentication backend for Device Cloud
    """

    def authenticate(self, username=None, password=None):
        """
        Authenticate credentials against Device Cloud

        args:
            username (str): Of the form "username#cloud_fqdn", containing:
                username - Device Cloud Username
                cloud_fqdn - Device Cloud's Fully Qualified Domain Name
                note: If cloud_fqdn is omitted, an optional global default
                    specified in settings.py may be used instead
            password (str): Device Cloud Password
        """

        # Verify all required parameters are present
        if username is None or password is None:
            logger.error('Authenticate called with missing arguments')
            return None

        dc_setting = app_settings.LIB_DIGI_DEVICECLOUD
        parse = username.split(
            dc_setting['USERNAME_CLOUD_DELIMETER'], 1)
        dc_username = parse[0]

        if len(parse) == 2:
            cloud_fqdn = parse[1]
        else:
            try:
                # Only username provided, use default server if provided
                cloud_fqdn = dc_setting['DEFAULT_CLOUD_SERVER']
            except KeyError:
                logger.error(
                    "Authenticate failed for username %s - No cloud fqdn " +
                    "provided and no default set" % username)
                return None

        # Check that username, password, fqdn match settings
        creds = (dc_username, password, cloud_fqdn)
        valid = any(creds == user.auth for user in app_settings.E2E_CREDENTIALS)

        if not valid:
            return None

        try:
            user = User.objects.get(username=dc_username,
                                    cloud_fqdn=cloud_fqdn)
        except User.DoesNotExist:
            # Create a new user, default to an unusable password.
            user = User.objects.create_user(username=dc_username,
                                            cloud_fqdn=cloud_fqdn)
        return user

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None


class DevicesList(APIView):
    """
    View to list devices belonging to the user
    ------------------------------------------

    *GET* - List devices from the user's Device Cloud account

    *POST* - Provision a new device to user's Device Cloud account.
                Required field:

    `mac` - MAC address of the module to provision

     _Authentication Required_
    """

    def get(self, request, format=None):
        """
        Return a list of Xbee WiFi devices on the authenticated user's Device
        Cloud account
        """
        username, password, cloud_fqdn = get_credentials(request)

        if not username or not password or not cloud_fqdn:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        creds = (username, password, cloud_fqdn)
        if not any(user.auth == creds for user in app_settings.E2E_CREDENTIALS):
            # No matching auth
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        # We know there is a matching user for the current credentials, so just
        # retrieve their device list
        e2e_devices = next(
            user.devices for user in app_settings.E2E_CREDENTIALS if \
                    user.auth == (username, password, cloud_fqdn))

        # Return a deepcopy of the devices instead. May be a slight performance
        # hit, but it avoids potential issues with overriding values in the
        # dictionaries.
        from copy import deepcopy
        e2e_devices = deepcopy(e2e_devices)

        # Save a cached local list of devices for this user, which we can
        # check to control access to signals, etc
        request.session['user_devices'] = \
            [device['devConnectwareId'] for device in e2e_devices['items']]

        # Extend the list with anything that's in the e2e session's new device
        # cache (that is, any devices that have been manually added by the
        # "user" this session)
        e2e_devices['items'].extend(request.session.get('new_devices', []))

        # Inject a url to each item pointing to the individual view for
        # that device
        for device in e2e_devices['items']:
            if 'devConnectwareId' not in device:
                fmt = "00000000-00000000-{}{}{}FF-FF{}{}{}"
                pieces = device['devMac'].upper().split(':')
                cwid = fmt.format(*pieces)
                device['devConnectwareId'] = cwid

            device['url'] = reverse(
                'devices-detail',
                kwargs={'device_id': device['devConnectwareId']},
                request=request)

        return Response(data=e2e_devices)

    def post(self, request, format=None):
        """
        Provision a new device to authenticated user's Device Cloud account
        """
        creds = get_credentials(request)
        username, password, cloud_fqdn = creds

        if not username or not password or not cloud_fqdn:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not any(user.auth == creds for user in app_settings.E2E_CREDENTIALS):
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        if 'mac' in request.DATA:
            mac = request.DATA['mac']
        else:
            return Response(status=status.HTTP_400_BAD_REQUEST,
                            data="MAC address field required")

        # 'device already exists' if mac == 00123456789A (one of the
        # devices returned in the GET response)
        if mac.upper() == "00123456789A":
            # TODO: Return a Device Cloud-like error body.
            return Response(status=status.HTTP_400_BAD_REQUEST,
                            data="Device already exists")

        if len(mac) > 12:
            # We expect the MAC address to be 12 hex characters. Any longer
            # than that, and we'll reject it.
            return Response(status=status.HTTP_400_BAD_REQUEST,
                            data="MAC address field is too long")
        else:
            # Pad mac with zeroes, up to 12 characters
            mac = mac.upper().zfill(12)
            # Chunk mac into 2-char pieces, join with colons
            mac = ':'.join(re.findall('..', mac))

        new_devices = request.session.get('new_devices', [])

        # Check that none of the new devices have the same MAC
        matches = filter(lambda d: d.get('devMac').upper() == mac.upper(),
                         new_devices)
        if len(matches):
            # TODO: Return a Device Cloud-like error body.
            return Response(status=status.HTTP_400_BAD_REQUEST,
                            data="Device already exists")

        newdev = {
            "dpDeviceType": "ConnectPort X2e ZB Wi-Fi",
            "dpDescription": "New Gateway: {}".format(mac),
            'devMac': mac,
        }
        new_devices.append(newdev)
        # Save the device list to the session
        request.session['new_devices'] = new_devices

        # clear out the session device list cache
        if 'user_devices' in request.session:
            del request.session['user_devices']

        return Response(data={})


class GatewayConfig(APIView):
    """
    Mock RCI query_setting and set_setting interface for gateways.

     _Authentication Required_
    """

    def get(self, request, device_id, format=None):
        """
        Query Device Cloud to return current device settings
        """
        username, password, cloud_fqdn = get_credentials(request)

        if not username or not password or not cloud_fqdn:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        creds = (username, password, cloud_fqdn)
        if not any(user.auth == creds for user in app_settings.E2E_CREDENTIALS):
            # No matching auth
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        if 'gw_config' not in request.session:
            request.session['gw_config'] = {}
        if device_id not in request.session['gw_config']:
            request.session['gw_config'][device_id] = {}

        config = request.session['gw_config'][device_id]

        return Response(data={})

    def put(self, request, device_id=None):
        # Basic sanity check on the values we're trying to send
        for group, settings in request.DATA.items():
            if not type(settings) == dict:
                return Response(status=status.HTTP_400_BAD_REQUEST)
            else:
                for key, val in settings.items():
                    if not isinstance(val, (int, float, bool, str, unicode)):
                        return Response(status=status.HTTP_400_BAD_REQUEST)

        username, password, cloud_fqdn = get_credentials(request)

        if not username or not password or not cloud_fqdn:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if 'gw_config' not in request.session:
            request.session['gw_config'] = {}
        settings = request.session['gw_config'].get(device_id, {})
        settings.update(request.DATA)

        return Response(data=settings)


class XBeeConfig(APIView):
    """
    View to show settings configuration for an individual XBee radio
    ------------------------------------------

    *GET* - Show SCI/RCI query_setting for the specified device.

      - Query params: ?cache="true/false" - Whether to return cached settings,
        or query the device. Default false.

    *PUT* - Set device settings via SCI/RCI set_setting. Accepts a json object
            of the form `{"setting_group" : {"key":"value", ...}, ...}`

     _Authentication Required_
    """

    def get(self, request, device_id, radio, format=None):
        """
        Query Device Cloud to return current device settings
        """
        username, password, cloud_fqdn = get_credentials(request)

        if not username or not password or not cloud_fqdn:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        creds = (username, password, cloud_fqdn)
        if not any(user.auth == creds for user in app_settings.E2E_CREDENTIALS):
            # No matching auth
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        if 'xbee_config' not in request.session:
            request.session['xbee_config'] = {}

        if device_id not in request.session['xbee_config']:
            request.session['xbee_config'][device_id] = {}

        if radio not in request.session['xbee_config'][device_id]:
            request.session['xbee_config'][device_id][radio] = {}

        settings = request.session['xbee_config'][device_id][radio]

        resp = settings
        settings['config-kit-stock-values'] = \
            compare_config_with_stock(resp)

        return Response(data=settings)

    def put(self, request, device_id, radio):
        # Basic sanity check on the values we're trying to send
        for group, settings in request.DATA.items():
            if not type(settings) == dict:
                return Response(status=status.HTTP_400_BAD_REQUEST)
            else:
                for key, val in settings.items():
                    if not isinstance(val, (int, float, bool, str, unicode)):
                        return Response(status=status.HTTP_400_BAD_REQUEST)

        username, password, cloud_fqdn = get_credentials(request)

        if not username or not password or not cloud_fqdn:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        creds = (username, password, cloud_fqdn)
        if not any(user.auth == creds for user in app_settings.E2E_CREDENTIALS):
            # No matching auth
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        if 'xbee_config' not in request.session:
            request.session['xbee_config'] = {}

        if device_id not in request.session['xbee_config']:
            request.session['xbee_config'][device_id] = {}

        if radio not in request.session['xbee_config'][device_id]:
            request.session['xbee_config'][device_id][radio] = {}

        request.session['xbee_config'][device_id][radio].update(settings)

        return Response(data={})


class XBeeList(APIView):
    """
    View to show XBees associated with a given gateway
    ------------------------------------------

    *GET* - Show all XBees currently associated with this device


     _Authentication Required_
    """

    def get(self, request, device_id=None, format=None):
        username, password, cloud_fqdn = get_credentials(request)

        if not username or not password or not cloud_fqdn:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        creds = (username, password, cloud_fqdn)
        if not any(user.auth == creds for user in app_settings.E2E_CREDENTIALS):
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        # Get the e2e user definition
        e2e_user = next(u for u in app_settings.E2E_CREDENTIALS if u.auth == creds)

        cache = self.request.QUERY_PARAMS.get('cache', 'true')
        try:
            cache = bool(strtobool(cache))
        except ValueError:
            # Unable to parse cache param. Default to True.
            cache = True

        # If a device ID is being used, and that device is offline, return an
        # error indicating that the device is offline. (This gives us more
        # realistic simulation of real data and interactions.)
        if device_id and not cache:
            devices = e2e_user.devices['items']
            offline_match = lambda d: (d['devConnectwareId'] == device_id
                                       and d['dpConnectionStatus'] in [0, '0'])

            if any(offline_match(dev) for dev in devices):
                # The device whose XBees we want is offline.
                return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                data={"error": ["Device Not Connected"]})

        xbees = next(user.xbees for user in app_settings.E2E_CREDENTIALS if \
                     user.auth == creds)
        from copy import deepcopy
        xbees = deepcopy(xbees)

        if device_id:
            correct_device = lambda xbee: device_id == xbee['devConnectwareId']
            res = filter(correct_device, xbees['items'])
            xbees['items'] = res
            xbees['resultSize'] = xbees['resultTotalRows'] = str(len(res))

        return Response(data=xbees)


class XBeeExplicitList(APIView):
    """
    View to show XBees in your Device Cloud account
    ------------------------------------------

    *GET* - Show all XBees currently cached in your Device Cloud account


     _Authentication Required_
    """

    def get(self, request, format=None):
        """
        Query E2E server for XBees
        """
        username, password, cloud_fqdn = get_credentials(request)

        if not username or not password or not cloud_fqdn:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        creds = (username, password, cloud_fqdn)
        if not any(user.auth == creds for user in app_settings.E2E_CREDENTIALS):
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        # The 'or None' here is so that if query is an empty string, etc. we
        # convert it to None
        addrs = self.request.QUERY_PARAMS.getlist('ext_addr', None) or None

        # Turn addrs into a list if it isn't already
        if addrs is not None and not (isinstance(addrs, list)):
            addrs = [addrs]
            logger.debug("Querying for XBees, ext_addr=%s", addrs)

        xbees = next(user.xbees['items'] for user in app_settings.E2E_CREDENTIALS
                     if user.auth == creds)

        if addrs:
            # Filter down the list to only matching extended addresses.
            xbees = [xbee for xbee in xbees if xbee['xpExtAddr'] in addrs]

        return Response(data=xbees)

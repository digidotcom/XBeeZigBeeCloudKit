from collections import namedtuple


user_fields = "username password fqdn devices xbees"

class E2EUser(namedtuple('E2EUser', user_fields)):
    """Encapsulate information for a mock user of the E2E application."""
    def __new__(cls, username, password, fqdn, devices=None, xbees=None):
        """Allow optional arguments for devices and xbees

        stackoverflow.com/a/16721002
        """

        if devices is None:
            devices = []
        if xbees is None:
            xbees = []

        # Wrap the devices argument with the DeviceCore response format
        devices = dict(
            remainingSize="0", requestedSize="1000",
            resultSize=str(len(devices)), requestedStartRow="0",
            resultTotalRows=str(len(devices)),
            items=devices
        )

        # TODO Wrap xbees with the XbeeCore format
        # and possibly parse values in xbees to wrap them...?
        xbeecount = len(xbees)
        xbees = dict(
            remainingSize="0", requestedSize="1000",
            requestedStartRow="0",
            resultSize=str(xbeecount), resultTotalRows=str(xbeecount),
            items=xbees
        )

        return super(E2EUser, cls).__new__(
            cls, username, password, fqdn, devices, xbees)

    @property
    def auth(self):
        return (self.username, self.password, self.fqdn)


def E2EGateway(**kwargs):
    if 'dpConnectionStatus' not in kwargs:
        kwargs['dpConnectionStatus'] = "0"

    return dict(**kwargs)


user1_devices = [
    E2EGateway(
        devConnectwareId="00000000-00000000-001234FF-FF56789A",
        dpDeviceType="ConnectPort X2e ZB Wi-Fi",
        dpDescription="My First Gateway",
        dpConnectionStatus="1",
        devMac="00:12:34:56:78:9A"),
    E2EGateway(
        devConnectwareId="00000000-00000000-000000FF-FF000123",
        dpDescription="", devMac="00:00:00:00:01:23")
]
user2_devices = []
user3_devices = [
    E2EGateway(
        devConnectwareId="00000000-00000000-005678FF-FF9ABCDE",
        dpDeviceType="XBee Gateway Wi-Fi",
        dpConnectionStatus="1",
        dpDescription="Testing XBGW", devMac="00:56:78:9A:BC:DE"),
    E2EGateway(
        devConnectwareId="00000000-00000000-005678FF-FF9ABCDF",
        dpDeviceType="XBee Gateway Wi-Fi",
        dpConnectionStatus="1",
        devMac="00:56:78:9A:BC:DF")
]
user4_devices = [
    E2EGateway(
        devConnectwareId="00000000-00000000-001234FF-FF567898",
        dpDeviceType="XBee Gateway Wi-Fi",
        dpConnectionStatus="1",
        dpDescription="Test", devMac="00:12:34:56:78:98"
    )
]


user3_xbees = [
    # Gateway XBee (coordinator)
    dict(
        devConnectwareId="00000000-00000000-005678FF-FF9ABCDE",
        xpExtAddr="00:13:A2:00:11:22:33:43",
        xpNodeType="0",
        xpNetAddr="0"
    ),
    # Remote XBee (router)
    dict(
        devConnectwareId="00000000-00000000-005678FF-FF9ABCDE",
        xpExtAddr="00:13:A2:00:11:22:33:44",
        xpNodeId="MY XBEE",
        xpNetAddr="1",
        xpNodeType="1"
    ),
    # Another remote XBee (router)
    dict(
        devConnectwareId="00000000-00000000-005678FF-FF9ABCDE",
        xpExtAddr="00:13:A2:00:11:22:33:45",
        xpNodeId="MY OTHER XBEE",
        xpNetAddr="2",
        xpNodeType="1"
    )
]

e2e_users = [
    # User who already has some devices in their account.
    # (FQDN is e2e_fqdn as opposed to my.devicecloud.com, etc. This allows
    # us to test logging in on 'custom' server URLS, by navigating to
    # #/login/<FQDN>)
    E2EUser("e2e_user", "e2e_password", "e2e_fqdn", user1_devices),
    # User with no devices in their account
    E2EUser("e2e_user_nodevices", "e2e_password", "my.devicecloud.com",
            user2_devices),
    # User with just one device in their account
    E2EUser("test_user", "e2e_password", "my.devicecloud.com",
            devices=user3_devices, xbees=user3_xbees),
    # User with only one device
    E2EUser("e2e_user_1device", "e2e_password", "my.devicecloud.com",
            devices=user4_devices)
]

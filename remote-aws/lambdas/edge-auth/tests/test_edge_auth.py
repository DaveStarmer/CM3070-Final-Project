from unittest import TestCase
from unittest.mock import patch, Mock

from ..handler import get_parameters


class TestEdgeAuth(TestCase):
    @patch("handler.boto3.client")
    def test_get_params(self, boto3_client):
        get_param_mock = Mock()
        get_param_mock.return_value = {
            "Parameters": [
                {"Name": "domain-name", "Value": "domain-name"},
                {"Name": "user-pool-id", "Value": "user-pool-id"},
                {"Name": "user-pool-client-id", "Value": "user-pool-client-id"},
                {"Name": "user-pool-client-secret", "Value": "user-pool-client-secret"},
                {"Name": "cognito-endpoint", "Value": "cognito-endpoint"},
            ]
        }
        boto3_client.return_value = get_param_mock

        actual = get_parameters()
        assert all(x["Name"] == x["Value"] for x in actual)

from unittest import TestCase

from handler import handler_function


class TestEdgeResponse(TestCase):
    def test_handler(self):
        """test cookie correctly passed back"""
        test_event = {
            "Records": [
                {
                    "cf": {
                        "response": {"headers": {}},
                        "request": {"querystring": "code=123456"},
                    }
                }
            ]
        }

        actual = handler_function(test_event, "")

        assert actual["headers"]["set-cookie"][0]["value"].startswith(
            "session-id=123456"
        )

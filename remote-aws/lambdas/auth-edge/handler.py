"""Lambda Authorisation at Edge
"""

import os
import urllib


def handler_function(event: dict, _) -> dict:
    """Lambda entry point to verify user is signed in, or redirect to sign in page

    Args:
        event (dict): AWS-Generated Event
        _ (any): AWS-Generated Context (unused in this function)

    Returns:
        dict: HTTP Response
    """
    response = check_sign_in(event["Records"][0]["cf"]["request"])

    return response


def check_sign_in(request: dict) -> dict:
    """Verify user is signed in and return appropriate response

    If user is signed in, allow to proceed to the requested URL, otherwise redirect to sign in

    Args:
        request (dict): request dict

    Returns:
        dict: HTTP request - either the original request (signed in) or a redirect (not signed in)
    """
    headers = request["headers"]

    # Check for session-id in cookie, if present, then proceed with request
    cookies = parse_cookies_from_header(headers)
    if cookies and "session-id" in cookies:
        # already authenticated - return initial request
        return request

    # create sign in URL with requested URL encoded in the querystring
    signin_url = create_signin_url(request)

    # return redirect response
    return {
        "headers": {
            "location": [
                {
                    "key": "Location",
                    "value": signin_url,
                }
            ]
        },
        "status": "302",
    }


def parse_cookies_from_header(headers: dict) -> dict:
    """Parse cookies from header

    Args:
        headers (dict): HTTP headers passed to lambda function

    Returns:
        dict: cookies as key-value pairs
    """
    if "cookie" in headers:
        # get all cookies as a list from the string
        cookies_split = headers["cookie"][0]["value"].split(";")

        # nested comprehension to give cookies as a dictionary
        # the inner comprehension returns a list of key-value lists
        # the outer comprehension returns a dictionary with leading and trailing whitespace removed
        cookies = {
            kvp[0].strip(): kvp[1].strip()
            for kvp in [cookie.split("=") for cookie in cookies_split if cookie]
        }
        return cookies

    # default return value (empty dict)
    return {}


def create_signin_url(request: dict) -> str:
    """Create signin URL with originally requested URL in querystring

    Args:
        request (dict): original request

    Returns:
        str: return URL
    """

    # elements of original URL to encode
    host = request["headers"]["host"][0]["value"]
    uri = request["uri"]
    querystring = request["querystring"]

    # encode the original request url to pass as query parameter in sign in request
    original_url = f"https://{host}{uri}?{querystring}"
    original_url_encoded = urllib.parse.quote_plus(original_url.encode("utf-8"))

    # return url to redirect to including the encoded original destination
    return (
        f"https://www.{os.environ['domain']}/signin?redirect_url={original_url_encoded}"
    )
